"""
Hotel Service
Handles business logic for hotel management and directory searching.
"""

from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any, cast
from supabase import Client
from fastapi import HTTPException
from backend.services.serpapi_client import serpapi_client
from backend.services.dataforseo_client import dataforseo_client
from backend.utils.helpers import log_query


async def search_hotel_directory_logic(
    q: str, user_id: Optional[UUID], db: Client, city: Optional[str] = None
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
        if not text:
            return ""
        text = text.lower()
        # Turkish normalization
        rep = {
            "ı": "i",
            "i̇": "i",
            "i": "i",
            "ğ": "g",
            "ü": "u",
            "ş": "s",
            "ö": "o",
            "ç": "c",
            "â": "a",
            "î": "i",
            "û": "u",
        }
        for char, target in rep.items():
            text = text.replace(char, target)
        return text.strip()

    q_normalized = normalize_term(q_trimmed)
    q_words = q_normalized.split()

    # 1. Local Lookup (Primary)
    query = db.table("hotel_directory").select("*")
    
    # EXPLANATION: Smart Location Filtering
    # If a city is selected in the UI, we prioritize results from that location.
    # We treat empty strings or "Select City" values as None.
    clean_city = city.strip() if city and city.strip() and city.lower() != "select city" else None
    
    if clean_city:
        query = query.ilike("location", f"%{clean_city}%")

    # Simple OR matching for multi-word search, plus a catch-all for the full string
    conditions = [f"name.ilike.%{q_normalized}%", f"location.ilike.%{q_normalized}%"]
    for w in q_words:
        if len(w) >= 3:
            # Avoid redundant conditions if word is already q_normalized
            if w != q_normalized:
                conditions.append(f"name.ilike.%{w}%")
                conditions.append(f"location.ilike.%{w}%")

    result = query.or_(",".join(conditions)).limit(200).execute()

    local_results = []
    for h in result.data or []:
        h_name_norm = normalize_term(h.get("name", ""))
        h_loc_norm = normalize_term(h.get("location", ""))
        h_combined = f"{h_name_norm} {h_loc_norm}"
        # Scoring logic using list summing to satisfy linter
        # Simplified scoring logic
        hotel_score: int = 0
        if h_name_norm == q_normalized:
            hotel_score = hotel_score + 100
        elif h_name_norm.startswith(q_normalized):
            hotel_score = hotel_score + 50
        elif q_normalized in h_name_norm:
            hotel_score = hotel_score + 40
        
        # Word-based score: Boost if ALL words match (position independent)
        matches_all_words = all(w in h_combined for w in q_words)
        if matches_all_words:
            hotel_score = hotel_score + 60

        for w in q_words:
            if w in h_combined:
                hotel_score = cast(int, hotel_score) + 10

        h["_search_score"] = float(hotel_score)
        local_results.append(h)

    # Check for good local matches
    has_good_local = any(h["_search_score"] >= 40 for h in local_results)

    # 2. Live Fallback (SerpApi)
    # Only fallback if local results are poor or sparse
    should_fallback = (not has_good_local or len(local_results) < 5) and len(
        q_trimmed
    ) >= 4

    # Primary sort by score (desc), secondary by name (asc)
    merged_results: List[Dict[str, Any]] = sorted(
        local_results, 
        key=lambda x: (-x.get("_search_score", 0), x.get("name", "").lower())
    )

    if should_fallback:
        try:
            # If no city, we try to broaden the query slightly for better search engine discovery
            live_query = f"{q_trimmed} Hotel"
            if clean_city:
                live_query += f" {clean_city}"
            else:
                # If no city, typing often implies common brands or locations
                # We can try to keep it simple but maybe add "Location" to hint search engine if needed
                pass

            live_results = await serpapi_client.search_hotels(live_query, limit=10)

            # Filter and merge live results
            for lr in live_results:
                lr_norm = normalize_term(lr["name"] + " " + lr.get("location", ""))
                # If query is short, we need to be stricter with word match
                if any(w in lr_norm for w in q_words):
                    lr["source"] = "serpapi"
                    # Avoid duplicates with sophisticated name comparison
                    if not any(
                        normalize_term(res.get("name", "")) in lr_norm or lr_norm in normalize_term(res.get("name", ""))
                        for res in local_results
                    ):
                        merged_results.append(lr)
        except Exception as e:
            print(f"Directory Fallback Error: {e}")

    if user_id:
        await log_query(
            db=db,
            user_id=user_id,
            hotel_name=q_trimmed,
            location=clean_city,
            action_type="search",
            api_key_suffix=serpapi_client.last_used_key_suffix,
        )

    # Return top matches with explicit casting to satisfy linter
    final_output = cast(List[Dict[str, Any]], list(merged_results[:40]))
    return final_output


async def sync_directory_manual_logic(db: Client) -> Dict[str, Any]:
    """
    Backfills the hotel_directory from the existing user-specific hotels table.

    Why: Ensures that hotel data added by users before the directory feature
    existed becomes shared and searchable by others.
    """
    # Fetch unique hotels from the main table
    hotels_res = (
        db.table("hotels")
        .select("name, location, serp_api_id")
        .is_("deleted_at", "null")
        .execute()
    )
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
                "review_count": h.get("review_count"),
            }

    count = 0
    for h_data in unique_hotels.values():
        try:
            # Persistent check to avoid duplicates in the shared directory
            db.table("hotel_directory").upsert(
                h_data, on_conflict="serp_api_id"
            ).execute()
            count += 1
        except Exception:
            continue

    return {"status": "success", "count": count}


async def add_hotel_to_account_logic(
    hotel_data: Dict[str, Any], user_id: UUID, db: Client
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
        phone = hotel_data.get("phone")
        email = hotel_data.get("email")
        website = hotel_data.get("website")
        address = hotel_data.get("address")
        description = hotel_data.get("description")
        cid = hotel_data.get("cid")
        place_id = hotel_data.get("place_id")

        d = {}  # Directory match data — initialized empty for safe fallback
        if not serp_api_id or not phone:
            name = hotel_data.get("name")
            location = hotel_data.get("location")
            if name:
                # 1. First check local directory
                dir_res = (
                    db.table("hotel_directory")
                    .select("*")
                    .eq("name", name)
                    .eq("location", location)
                    .execute()
                )
                if dir_res.data:
                    d = dir_res.data[0]
                    serp_api_id = serp_api_id or d.get("serp_api_id")
                    rating = rating or d.get("rating")
                    review_count = review_count or d.get("review_count")
                    image_url = image_url or d.get("image_url")
                    phone = phone or d.get("phone")
                    email = email or d.get("email")
                    website = website or d.get("website")
                    address = address or d.get("address")
                    description = description or d.get("description")
                    cid = cid or d.get("cid")
                    place_id = place_id or d.get("place_id")
                    
                # 2. DataForSEO Enrichment (DEPRECATED - DEFAULT OFF)
                # KAİZEN: Removed automatic third-party enrichment to respect data fidelity and cost control.
                # Only re-enable if explicitly requested by the user.
                """
                if not phone or not website or not address:
                    try:
                        enrich_data = await dataforseo_client.get_hotel_details(name, location or "")
                        if enrich_data:
                            phone = phone or enrich_data.get("phone")
                            website = website or enrich_data.get("website")
                            address = address or enrich_data.get("address")
                            rating = rating or enrich_data.get("rating")
                            review_count = review_count or enrich_data.get("review_count")
                            cid = cid or enrich_data.get("cid")
                            place_id = place_id or enrich_data.get("place_id")
                            # Add coordinates if missing
                            hotel_data["latitude"] = hotel_data.get("latitude") or enrich_data.get("latitude")
                            hotel_data["longitude"] = hotel_data.get("longitude") or enrich_data.get("longitude")
                    except Exception as e:
                        print(f"DataForSEO Enrichment Error: {e}")
                """
                pass
        # [FIX] Extract property_token if directory match found
        property_token = hotel_data.get("property_token")
        
        property_token = property_token or d.get("property_token")
        serp_api_id = serp_api_id or d.get("serp_api_id")

        # Prepare data for insertion
        data = {
            "user_id": str(user_id),
            "name": hotel_data.get("name"),
            "location": hotel_data.get("location"),
            "is_target_hotel": hotel_data.get("is_target_hotel", False),
            "serp_api_id": serp_api_id,
            "property_token": property_token,  # [FIX] Added property_token
            "preferred_currency": hotel_data.get("preferred_currency", "USD"),
            "rating": rating,
            "review_count": review_count,
            "image_url": image_url,
            "phone": phone,
            "email": email,
            "website": website,
            "address": address,
            "description": description,
            "cid": cid,
            "place_id": place_id,
            "sentiment_breakdown": (hotel_data.get("sentiment_breakdown") or d.get("sentiment_breakdown")) if isinstance(hotel_data.get("sentiment_breakdown") or d.get("sentiment_breakdown"), list) else None,
            "reviews": (hotel_data.get("reviews") or d.get("reviews")) if isinstance(hotel_data.get("reviews") or d.get("reviews"), list) else None,
        }

        # Insert into user's hotels list
        result = db.table("hotels").insert(data).execute()

        if result.data:
            await log_query(
                db=db,
                user_id=user_id,
                hotel_name=data["name"],
                location=data.get("location"),
                action_type="add_to_account",
                api_key_suffix=serpapi_client.last_used_key_suffix,
            )

            # EXPLANATION: Collaborative Data Growth
            # When a user tracks a new property, we capture its latest signature
            # (coordinates, images, ratings) and share it with the global directory.
            try:
                db.table("hotel_directory").upsert(
                    {
                        "name": data["name"],
                        "location": data.get("location"),
                        "serp_api_id": data.get("serp_api_id"),
                        "latitude": hotel_data.get("latitude"),
                        "longitude": hotel_data.get("longitude"),
                        "rating": data.get("rating"),
                        "stars": hotel_data.get("stars"),
                        "review_count": data.get("review_count"),
                        "image_url": data.get("image_url"),
                        "phone": data.get("phone"),
                        "email": data.get("email"),
                        "website": data.get("website"),
                        "address": data.get("address"),
                        "description": data.get("description"),
                        "cid": data.get("cid"),
                        "place_id": data.get("place_id"),
                        "sentiment_breakdown": data.get("sentiment_breakdown"),
                        "reviews": data.get("reviews"),
                        "last_verified_at": datetime.now().isoformat(),
                    },
                    on_conflict="serp_api_id",
                ).execute()
            except Exception as e:
                print(f"Directory Auto-Sync Warning: {e}")

            return result.data[0]

        return {"error": "Failed to add hotel"}
    except Exception as e:
        print(f"Add Hotel Logic Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
