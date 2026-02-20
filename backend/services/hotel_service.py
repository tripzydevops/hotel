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
        if not text: return ""
        # Improved Turkish normalization
        text = text.lower()
        rep = {
            "ı": "i", "i̇": "i", "i": "i", 
            "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c"
        }
        for char, target in rep.items():
            text = text.replace(char, target)
        # Standardize hotel terminology
        text = text.replace("otel", "hotel").replace("residences", "residence")
        return text.strip()

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
            
            # Match Rule: 
            # 1. Base keyword match (always required for local DB search)
            if not all(w in h_combined for w in q_words):
                continue
                
            # 2. City Filter: Pass if city matches OR has a property token (Global Inclusion Rule)
            has_token = h.get("serp_api_id") is not None
            if city_norm in h_combined or has_token:
                local_results.append(h)
        local_results = local_results[:20]
    else:
        # Standard search (Multi-word support)
        result = query.or_(f"name.ilike.%{q_words[0]}%,location.ilike.%{q_words[0]}%") \
            .limit(100) \
            .execute()
        
        filtered = []
        for h in (result.data or []):
            h_combined = normalize_term(h.get("name", "") + " " + h.get("location", ""))
            # Must match ALL query words for high precision
            if all(w in h_combined for w in q_words):
                filtered.append(h)
        local_results = filtered[:20]

    # STRICT FILTERING: If city is provided, we must filter out local results that don't match.
    # This fixes the issue where "Altin" returns "Grand Altuntas (Aksaray)" even when City="Balikesir".
    if city:
        city_norm = normalize_term(city)
        strict_local = []
        for h in local_results:
            # Check if location contains the city
            h_loc = normalize_term(h.get("location", ""))
            # Also check if the hotel has a property token - we generally keep these as they are high value,
            # BUT if the user explicitly asked for a city, we should prioritize that.
            # Let's be strict: If location is known and doesn't match, drop it.
            if city_norm in h_loc:
                strict_local.append(h)
            elif not h.get("location"): 
                # Keep if location unknown, just in case
                strict_local.append(h)
        
        local_results = strict_local

    # Check for exact match in local results to avoid unnecessary fallback
    has_exact_match = False
    normalized_q = normalize_term(q_trimmed)
    for h in local_results:
        # Check name mostly
        if normalize_term(h.get("name", "")) == normalized_q:
            has_exact_match = True
            break

    merged_results: List[Dict[str, Any]] = list(local_results)
    
    # 2. Live Fallback: Trigger if local results are sparse OR no exact match found
    # Relaxed condition: If we haven't found exactly what they want, ask Google.
    should_fallback = (len(local_results) < 20) or (not has_exact_match and len(q_trimmed) >= 4)
    
    
    if should_fallback and len(q_trimmed) >= 2:
        try:
            # Contextual Biasing: If no city provided, try to infer from user profile
            effective_city = city
            if not effective_city and user_id:
                try:
                    profile = db.table("user_profiles").select("city").eq("id", str(user_id)).execute()
                    if profile.data: effective_city = profile.data[0].get("city")
                except: pass

            # Construct live query
            live_query = q_trimmed
            
            # EXPLANATION: Hospitality Context Injection
            # Google's Knowledge Graph can be finicky with short or generic terms (e.g. "Altin").
            # Appending "Hotel" ensures we trigger the specific "Hotel Booking" search layout
            # instead of a generic map or web search.
            keywords = ["hotel", "otel", "resort", "pansiyon", "apart", "motel", "camp", "lodge", "konak"]
            if not any(k in q_trimmed.lower() for k in keywords):
                live_query = f"{q_trimmed} Hotel"

            if effective_city and effective_city.lower() not in q_trimmed.lower():
                live_query = f"{live_query} {effective_city}"
            
            live_results = await serpapi_client.search_hotels(live_query, limit=10)
            
            # ZERO-RESULT FALLBACK: If specific query ("alt Hotel Balikesir") fails, 
            # try broad city search ("Balikesir") and filter locally.
            # This fixes "Altin" not being found because "alt" is a stop-word/prefix Google ignores.
            if not live_results and city:
                city_results = await serpapi_client.search_hotels(city, limit=25)
                # Filter broad results by the user's query
                for r in city_results:
                    # Normalized check
                    name_norm = normalize_term(r['name'])
                    if normalize_term(q_trimmed) in name_norm:
                        live_results.append(r)

            # Global Fallback: If no results with city, try WITHOUT city for maximum discovery
            # But only if we have still found nothing
            if not live_results and city and not live_results:
                live_results = await serpapi_client.search_hotels(q_trimmed, limit=10)

            # Token-Aware Filtering: 
            # 1. Keep any property that has a serp_api_id (Property Token)
            # 2. For others, enforce strict keyword matching
            valid_live = []
            for lr in live_results:
                has_token = lr.get("serp_api_id") is not None
                lr_norm = normalize_term(lr["name"] + " " + lr.get("location", ""))
                
                # Inclusion Rule: Has token OR matches at least one keyword
                if has_token or any(w in lr_norm for w in q_words):
                    # EXPLANATION: Location Backfill
                    # Detailed location data is critical for the UI. If Google returns "Unknown"
                    # (common for smaller properties), we use the User's requested City to 
                    # clearly place the hotel on the map.
                    if lr.get("location") == "Unknown" and city:
                         lr["location"] = city.title()
                    elif lr.get("location") == "Unknown" and effective_city:
                         lr["location"] = effective_city.title()
                         
                    valid_live.append(lr)

            # Badge and de-duplicate
            def get_id(h):
                return h.get("serp_api_id") or f"{h['name'].lower()}|{h.get('location', '').lower()}"

            local_ids = {get_id(h) for h in local_results}
            for lr in valid_live:
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
        await log_query(
            db=db, 
            user_id=user_id, 
            hotel_name=q_trimmed, 
            location=city, # Pass city if available
            action_type="search"
        )
    
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
                    "review_count": hotel_data.get("review_count"),
                    "last_verified_at": datetime.now().isoformat()
                }, on_conflict="serp_api_id").execute()
            except Exception as e:
                print(f"Directory Auto-Sync Warning: {e}")

            return result.data[0]
        
        return {"error": "Failed to add hotel"}
    except Exception as e:
        print(f"Add Hotel Logic Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
