"""
Hotel Service
Handles business logic for hotel management and directory searching.
"""

import re
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any
from supabase import Client
from fastapi import HTTPException
from backend.services.serpapi_client import serpapi_client
from backend.utils.helpers import log_query

async def search_hotel_directory_logic(
    q: str, 
    user_id: Optional[UUID], 
    db: Client,
    city: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Universal Search Fix:
    Searches the local hotel directory with smart normalization and falls back to 
    SerpApi with a relaxed query if local results are insufficient.
    """
    q_trimmed = q.strip()
    if len(q_trimmed) < 2:
        return []

    def normalize_term(text: str) -> str:
        if not text: return ""
        text = text.lower()
        # Turkish normalization
        rep = {
            "ı": "i", "i̇": "i", "i": "i", 
            "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c",
            "â": "a", "î": "i", "û": "u"
        }
        for char, target in rep.items():
            text = text.replace(char, target)
        return text.strip()

    q_normalized = normalize_term(q_trimmed)
    q_words = q_normalized.split()
    
    # 1. Local Lookup (Primary)
    query = db.table("hotel_directory").select("*")
    
    # Simple OR matching for multi-word search, plus a catch-all for the full string
    conditions = [f"name.ilike.%{q_normalized}%", f"location.ilike.%{q_normalized}%"]
    for w in q_words:
        if len(w) >= 3:
            conditions.append(f"name.ilike.%{w}%")
            conditions.append(f"location.ilike.%{w}%")
    
    result = query.or_(",".join(conditions)).limit(100).execute()
    
    local_results = []
    for h in (result.data or []):
        h_name_norm = normalize_term(h.get("name", ""))
        h_loc_norm = normalize_term(h.get("location", ""))
        h_combined = f"{h_name_norm} {h_loc_norm}"
        
        # Scoring: 
        # - Exact match: 100
        # - Starts with: 50
        # - Contains full string: 30
        # - Contains words: 10 per word
        score = 0
        if h_name_norm == q_normalized: score += 100
        elif h_name_norm.startswith(q_normalized): score += 50
        elif q_normalized in h_name_norm: score += 30
        
        for w in q_words:
            if w in h_combined: score += 10
            
        h["_search_score"] = score
        local_results.append(h)

    # Check for good local matches
    has_good_local = any(h["_search_score"] >= 40 for h in local_results)
    
    # 2. Live Fallback (SerpApi)
    # Only fallback if local results are poor or sparse
    should_fallback = (not has_good_local or len(local_results) < 5) and len(q_trimmed) >= 4
    
    merged_results = sorted(local_results, key=lambda x: x.get("_search_score", 0), reverse=True)
    
    if should_fallback:
        try:
            live_query = f"{q_trimmed} Hotel"
            if city: live_query += f" {city}"
            
            live_results = await serpapi_client.search_hotels(live_query, limit=10)
            
            # Filter and merge live results
            for lr in live_results:
                lr_norm = normalize_term(lr["name"] + " " + lr.get("location", ""))
                if any(w in lr_norm for w in q_words):
                    lr["source"] = "serpapi"
                    # Avoid duplicates
                    if not any(normalize_term(l.get("name", "")) == normalize_term(lr["name"]) for l in local_results):
                        merged_results.append(lr)
        except Exception as e:
            print(f"Directory Fallback Error: {e}")

    if user_id:
        await log_query(db=db, user_id=user_id, hotel_name=q_trimmed, location=city, action_type="search")
    
    return merged_results[:40]

async def sync_directory_manual_logic(db: Client) -> Dict[str, Any]:
    """
    Backfills the hotel_directory from the existing user-specific hotels table.
    
    Why: Ensures that hotel data added by users before the directory feature 
    existed becomes shared and searchable by others.
    """
    # Fetch unique hotels from the main table
    hotels_res = db.table("hotels").select("name, location, serp_api_id").is_("deleted_at", "null").execute()
    if not hotels_res.data:
        return {"status": "success", "count": 0}

    # Extract unique properties
    unique_hotels = {}
    for h in hotels_res.data:
        key = f"{h['name'].lower()}|{h.get('location', '').lower()}"
        if key not in unique_hotels:
            unique_hotels[key] = {
                "name": h["name"],
                "location": h.get("location"),
                "serp_api_id": h.get("serp_api_id"),
                "review_count": h.get("review_count")
            }

    count = 0
    for h_data in unique_hotels.values():
        try:
            # Persistent check to avoid duplicates in the shared directory
            db.table("hotel_directory").upsert(h_data, on_conflict="serp_api_id").execute()
            count += 1
        except Exception:
            continue
            
    return {"status": "success", "count": count}

async def add_hotel_to_account_logic(
    hotel_data: Dict[str, Any], 
    user_id: UUID, 
    db: Client
) -> Dict[str, Any]:
    """
    Associates a hotel with a user account.
    
    Why: Separates the API routing from the core business logic of hotel 
    association, allowing for validation and side-effects (like logging).
    """
    try:
        # KAİZEN: Automatic Token Discovery (Phase 1.1)
        # If the incoming hotel_data is missing a serp_api_id, we attempt to 
        # find a matching property in our global directory before inserting.
        serp_api_id = hotel_data.get("serp_api_id")
        
        # Prepare metadata defaults
        rating = hotel_data.get("rating")
        review_count = hotel_data.get("review_count")
        image_url = hotel_data.get("image_url")
        
        if not serp_api_id or not rating:
            name = hotel_data.get("name")
            location = hotel_data.get("location")
            if name:
                # KAİZEN: Use available columns (hotel_directory lacks review_count)
                dir_res = db.table("hotel_directory").select("serp_api_id, rating, image_url")\
                    .eq("name", name)\
                    .eq("location", location)\
                    .execute()
                if dir_res.data:
                    d = dir_res.data[0]
                    serp_api_id = serp_api_id or d.get("serp_api_id")
                    rating = rating or d.get("rating")
                    image_url = image_url or d.get("image_url")
                    print(f"Service: Auto-discovered metadata for {name}")

        # Prepare data for insertion
        data = {
            "user_id": str(user_id),
            "name": hotel_data.get("name"),
            "location": hotel_data.get("location"),
            "is_target_hotel": hotel_data.get("is_target_hotel", False),
            "serp_api_id": serp_api_id,
            "preferred_currency": hotel_data.get("preferred_currency", "USD"),
            "rating": rating,
            "review_count": review_count,
            "image_url": image_url
        }
        
        # Insert into user's hotels list
        result = db.table("hotels").insert(data).execute()
        
        if result.data:
            await log_query(
                db=db, 
                user_id=user_id, 
                hotel_name=data["name"], 
                location=data.get("location"),
                action_type="add_to_account"
            )
            
            # EXPLANATION: Collaborative Data Growth
            # When a user tracks a new property, we capture its latest signature 
            # (coordinates, images, ratings) and share it with the global directory.
            try:
                db.table("hotel_directory").upsert({
                    "name": data["name"],
                    "location": data.get("location"),
                    "serp_api_id": data.get("serp_api_id"),
                    "latitude": hotel_data.get("latitude"),
                    "longitude": hotel_data.get("longitude"),
                    "rating": hotel_data.get("rating"),
                    "stars": hotel_data.get("stars"),
                    "image_url": hotel_data.get("image_url"),
                    "last_verified_at": datetime.now().isoformat()
                }, on_conflict="serp_api_id").execute()
            except Exception as e:
                print(f"Directory Auto-Sync Warning: {e}")

            return result.data[0]
        
        return {"error": "Failed to add hotel"}
    except Exception as e:
        print(f"Add Hotel Logic Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
