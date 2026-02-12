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
    # EXPLANATION: City-Based Filtering
    # We added an optional 'city' parameter to allow users to narrow down 
    # hotel search results to a specific region, improving accuracy.
    """
    Searches the local hotel directory and falls back to serpapi if results are sparse.
    
    Why: Minimizes API costs by using local cached data first, while ensuring 
    new hotels are discoverable via live fallback.
    """
    q_trimmed = q.strip()
    
    # 1. Local Lookup (Primary)
    # Search in both name and location for better discoverability
    # Multi-word support: if multiple words, search for all as a combo
    q_words = q_trimmed.split()
    query = db.table("hotel_directory").select("name, location, serp_api_id")
    
    # Apply city filter if provided
    if city:
        # EXPLANATION: Strict City Filtering
        # Restrict the database lookup to only hotels matching the selected city.
        # This prevents "noise" from global results when a specific city is chosen.
        query = query.ilike("location", f"%{city}%")

    if len(q_words) > 1:
        # For multiple words, we use a slightly more complex filter or just rely on the first word + limit
        # Improved strategy: Search for the first word and filter local
        result = query.or_(f"name.ilike.%{q_words[0]}%,location.ilike.%{q_words[0]}%") \
            .limit(50) \
            .execute()
        
        filtered = []
        for h in (result.data or []):
            name_loc = (h.get("name", "") + " " + h.get("location", "")).lower()
            if all(w.lower() in name_loc for w in q_words):
                filtered.append(h)
        local_results = filtered[:20]
    else:
        result = query.or_(f"name.ilike.%{q_trimmed}%,location.ilike.%{q_trimmed}%") \
            .limit(20) \
            .execute()
        local_results = result.data or []
    merged_results: List[Dict[str, Any]] = list(local_results)
    
    # 2. Live Fallback: Trigger if local results are sparse (<3) and query is specific (>=3 chars)
    if len(local_results) < 3 and len(q_trimmed) >= 3:
        try:
            live_query = q_trimmed
            if city:
                live_query = f"{q_trimmed} {city}"

            live_results = await serpapi_client.search_hotels(live_query, limit=10)
            
            # Filter live results by city if provided to ensure strictness
            if city:
                # EXPLANATION: Live Results Filtering
                # SerpApi searches globally. We filter the live results post-fetch 
                # to ensure they match the user's selected city strictly.
                live_results = [
                    r for r in live_results 
                    if city.lower() in r.get("location", "").lower()
                ]

            lr: Dict[str, Any]
            for lr in live_results:
                lr["source"] = "serpapi" # Badge for UI differentiation
            
            # De-duplicate against local results to prevent confusing UI
            local_keys = {f"{h['name'].lower()}|{h.get('location', '').lower()}" for h in local_results}
            for lr in live_results:
                key = f"{lr['name'].lower()}|{lr.get('location', '').lower()}"
                if key not in local_keys:
                    merged_results.append(lr)
        except Exception as se:
            print(f"Directory Search Fallback Error: {se}")

    # 3. Analytics: Log the search event for market trend calculation
    if user_id:
        await log_query(
            db=db,
            user_id=user_id,
            hotel_name=q_trimmed,
            location=None,
            action_type="search",
            status="success" if merged_results else "no_results"
        )
    
    # Limit results to 10 using a linter-safe approach
    final_results: List[Dict[str, Any]] = []
    for i in range(min(10, len(merged_results))):
        final_results.append(merged_results[i])
    return final_results

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
            return result.data[0]
        
        return {"error": "Failed to add hotel"}
    except Exception as e:
        print(f"Add Hotel Logic Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
