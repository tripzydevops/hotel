"""
Hotel Service
Handles business logic for hotel management and directory searching.
"""

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
    
    def normalize_term(text: str) -> str:
        # Basic normalization for Turkish characters and case
        rep = {"ı": "i", "İ": "i", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u", "ş": "s", "Ş": "s", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c"}
        for char, target in rep.items():
            text = text.replace(char, target)
        # Normalize 'otel' to 'hotel' for matching
        text = text.lower().replace("otel", "hotel")
        return text

    # 1. Local Lookup (Primary)
    q_normalized = normalize_term(q_trimmed)
    q_words = q_normalized.split()
    query = db.table("hotel_directory").select("name, location, serp_api_id")
    
    # We apply city filter locally ONLY if it's very specific. 
    # Otherwise, we prioritize name match and filter later to avoid missing data.
    if city:
        city_norm = normalize_term(city)
        # We'll fetch more and filter in memory to handle slight name/location variations
        result = query.ilike("name", f"%{q_words[0]}%").limit(100).execute()
        
        local_results = []
        for h in (result.data or []):
            h_combined = normalize_term(h.get("name", "") + " " + h.get("location", ""))
            if all(w in h_combined for w in q_words) and city_norm in h_combined:
                local_results.append(h)
        local_results = local_results[:20]
    else:
        # Standard search
        result = query.or_(f"name.ilike.%{q_words[0]}%,location.ilike.%{q_words[0]}%") \
            .limit(100) \
            .execute()
        
        filtered = []
        for h in (result.data or []):
            h_combined = normalize_term(h.get("name", "") + " " + h.get("location", ""))
            if all(w in h_combined for w in q_words):
                filtered.append(h)
        local_results = filtered[:20]

    merged_results: List[Dict[str, Any]] = list(local_results)
    
    # 2. Live Fallback: Trigger if local results are sparse or we want more diversity
    # Threshold increased to 25 to ensure we check live data more often (e.g. 'alt' find 'Altın Otel' via SerpApi)
    if len(local_results) < 25 and len(q_trimmed) >= 2:
        try:
            # Construct a clean live query. Avoid duplicating city if already in name.
            live_query = q_trimmed
            if city and city.lower() not in q_trimmed.lower():
                live_query = f"{q_trimmed} {city}"

            live_results = await serpapi_client.search_hotels(live_query, limit=10)
            
            # Universal Fallback: If no results with city, try WITHOUT city for maximum discovery
            if not live_results and city:
                live_results = await serpapi_client.search_hotels(q_trimmed, limit=10)

            # Badge and de-duplicate
            # Priority: SerpApi ID > Name|Location slug
            def get_id(h):
                return h.get("serp_api_id") or f"{h['name'].lower()}|{h.get('location', '').lower()}"

            local_ids = {get_id(h) for h in local_results}
            for lr in live_results:
                lr["source"] = "serpapi"
                if get_id(lr) not in local_ids:
                    merged_results.append(lr)
        except Exception as se:
            print(f"Directory Search Fallback Error: {se}")

    # 3. Sort and Sample (Prioritize exact word matches or source variety)
    def result_score(r: Dict[str, Any]) -> float:
        name_lower = r['name'].lower()
        score = 0
        # Boost if query matches the start of a word
        for w in q_words:
            if f" {w}" in f" {name_lower}" or f" {w}" in f" {normalize_term(r.get('location', ''))}":
                score += 10
        # Slight boost for source variety if we have few locals
        if r.get("source") == "serpapi":
            score += 1
        return score

    sorted_results = sorted(merged_results, key=result_score, reverse=True)

    if user_id:
        await log_query(db=db, user_id=user_id, hotel_name=q_trimmed, action_type="search")
    
    return sorted_results[:10]

async def sync_directory_manual_logic(db: Client) -> Dict[str, Any]:
    """
    Backfills the hotel_directory from the existing user-specific hotels table.
    
    Why: Ensures that hotel data added by users before the directory feature 
    existed becomes shared and searchable by others.
    """
    # Fetch unique hotels from the main table
    hotels_res = db.table("hotels").select("name, location, serp_api_id").execute()
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
                "serp_api_id": h.get("serp_api_id")
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
        # Prepare data for insertion
        data = {
            "user_id": str(user_id),
            "name": hotel_data.get("name"),
            "location": hotel_data.get("location"),
            "is_target_hotel": hotel_data.get("is_target_hotel", False),
            "serp_api_id": hotel_data.get("serp_api_id"),
            "preferred_currency": hotel_data.get("preferred_currency", "USD")
        }
        
        # Insert into user's hotels list
        result = db.table("hotels").insert(data).execute()
        
        if result.data:
            await log_query(
                db=db, 
                user_id=user_id, 
                hotel_name=data["name"], 
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
