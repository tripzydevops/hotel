"""
Hotel Service
Handles business logic for hotel management and directory searching.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, cast
from uuid import UUID

from fastapi import HTTPException

from backend.utils.helpers import log_query
from supabase import Client


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
    clean_city = (
        city.strip()
        if city and city.strip() and city.lower() != "select city"
        else None
    )

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

    # 2. Live Fallback (Multi-Provider)
    # Only fallback if local results are poor or sparse
    should_fallback = (not has_good_local or len(local_results) < 5) and len(
        q_trimmed
    ) >= 4

    # Primary sort by score (desc), secondary by name (asc)
    merged_results: List[Dict[str, Any]] = sorted(
        local_results,
        key=lambda x: (-x.get("_search_score", 0), x.get("name", "").lower()),
    )

    if should_fallback:
        from backend.services.provider_factory import ProviderFactory

        live_query = f"{q_trimmed} Hotel"
        if clean_city:
            live_query += f" {clean_city}"

        active_providers = ProviderFactory.get_active_providers()

        for provider in active_providers:
            p_name = provider.get_provider_name()
            try:
                print(f"[Directory Search] Trying {p_name} for '{live_query}'")
                live_results = await provider.search_hotels(live_query, limit=10)

                if live_results:
                    # Filter and merge live results
                    found_new = False
                    for lr in live_results:
                        lr_norm = normalize_term(
                            lr["name"] + " " + lr.get("location", "")
                        )
                        # If query is short, we need to be stricter with word match
                        if any(w in lr_norm for w in q_words):
                            lr["source"] = p_name.lower()
                            # Avoid duplicates with sophisticated name comparison
                            if not any(
                                normalize_term(res.get("name", "")) in lr_norm
                                or lr_norm in normalize_term(res.get("name", ""))
                                for res in local_results
                            ):
                                merged_results.append(lr)
                                found_new = True

                    if found_new:
                        print(f"[Directory Search] SUCCESS with {p_name}")
                        break  # Stop if we found good results
                else:
                    print(f"[Directory Search] {p_name} returned no results")
            except Exception as e:
                print(f"[Directory Search] {p_name} Error: {e}")

    if user_id:
        await log_query(
            db=db,
            user_id=user_id,
            hotel_name=q_trimmed,
            location=clean_city,
            action_type="search",
            api_key_suffix="multi-provider",
        )

    # Return top matches
    final_output = cast(List[Dict[str, Any]], list(merged_results[:40]))
    return final_output


async def sync_directory_manual_logic(db: Client) -> Dict[str, Any]:
    """
    Backfills the hotel_directory from the existing user-specific hotels table.

    Why: Ensures that hotel data added by users before the directory feature
    existed becomes shared and searchable by others.
    """
    # Fetch hotels via user_hotels mapping for accurate multitenant directory enrichment
    res = db.table("user_hotels").select("hotel_id, hotels(*)").execute()
    data = res.data or []

    unique_hotels = {}
    for assoc in data:
        h = assoc.get("hotels")
        if not h or h.get("deleted_at"):
            continue
        key = f"{h['name'].lower()}|{h.get('location', '').lower()}"
        if key not in unique_hotels:
            unique_hotels[key] = {
                "name": h["name"],
                "location": h.get("location"),
                "property_token": h.get("property_token"),
                "serp_api_id": h.get("serp_api_id"),
                "review_count": h.get("review_count"),
            }

    count = 0
    for h_data in unique_hotels.values():
        try:
            # Conflict resolution: serp_api_id is the primary global identifier
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
    Associates a hotel with a user account using a Many-to-Many pattern.

    Why: Allows multiple accounts to monitor the same property while maintaining
    a single 'source of truth' in the hotels table. Prevents duplicates for the same user.
    """
    try:
        serp_api_id = hotel_data.get("serp_api_id")
        property_token = hotel_data.get("property_token")
        name = hotel_data.get("name")
        location = hotel_data.get("location")

        if not name:
            raise HTTPException(status_code=400, detail="Hotel name is required")

        # 1. Attempt to find existing master hotel record
        # Priority: serp_api_id > property_token > (name + location)
        existing_hotel = None
        if serp_api_id:
            h_res = (
                db.table("hotels").select("*").eq("serp_api_id", serp_api_id).execute()
            )
            if h_res.data:
                existing_hotel = h_res.data[0]

        if not existing_hotel and property_token:
            h_res = (
                db.table("hotels")
                .select("*")
                .eq("property_token", property_token)
                .execute()
            )
            if h_res.data:
                existing_hotel = h_res.data[0]

        if not existing_hotel:
            h_res = (
                db.table("hotels")
                .select("*")
                .eq("name", name)
                .eq("location", location)
                .execute()
            )
            if h_res.data:
                existing_hotel = h_res.data[0]

        hotel_id = None

        if existing_hotel:
            hotel_id = existing_hotel["id"]
            # Update missing metadata if provided in this call
            update_fields = {}
            for field in [
                "serp_api_id",
                "property_token",
                "latitude",
                "longitude",
                "address",
                "phone",
                "website",
                "cid",
                "place_id",
                "stars",
            ]:
                if not existing_hotel.get(field) and hotel_data.get(field):
                    update_fields[field] = hotel_data[field]

            if update_fields:
                upd_res = (
                    db.table("hotels")
                    .update(update_fields)
                    .eq("id", hotel_id)
                    .execute()
                )
                if upd_res.data:
                    existing_hotel = upd_res.data[0]
        else:
            # Prepare metadata for NEW master record
            # Automatic Token Discovery (Phase 1.1)
            # Find matching property in global directory if not provided
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
            serp_api_id = hotel_data.get("serp_api_id")
            property_token = hotel_data.get("property_token")

            dir_res = (
                db.table("hotel_directory")
                .select("*")
                .eq("name", name)
                .eq("location", location)
                .execute()
            )
            if dir_res.data:
                d = dir_res.data[0]
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
                serp_api_id = serp_api_id or d.get("serp_api_id")
                property_token = property_token or d.get("property_token")

            new_hotel_data = {
                "name": name,
                "location": location,
                "serp_api_id": serp_api_id,
                "property_token": property_token,
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
                "sentiment_breakdown": hotel_data.get("sentiment_breakdown"),
                "reviews": hotel_data.get("reviews"),
                "latitude": hotel_data.get("latitude"),
                "longitude": hotel_data.get("longitude"),
                "stars": hotel_data.get("stars"),
            }

            insert_res = db.table("hotels").insert(new_hotel_data).execute()
            if not insert_res.data:
                raise HTTPException(
                    status_code=500, detail="Failed to create hotel record"
                )
            existing_hotel = insert_res.data[0]
            hotel_id = existing_hotel["id"]

        # 2. Add/Verify Association in user_hotels
        # Handle Target Toggle (User Specific)
        is_target = hotel_data.get("is_target_hotel", False)
        if is_target:
            db.table("user_hotels").update({"is_target": False}).eq(
                "user_id", str(user_id)
            ).execute()

        # We use upsert to ensure (user_id, hotel_id) uniqueness is respected
        assoc_data = {
            "user_id": str(user_id),
            "hotel_id": hotel_id,
            "is_target": is_target,
            "is_monitored": True,
            "pricing_dna": hotel_data.get("pricing_dna", {}),
            "preferred_currency": hotel_data.get("preferred_currency", "TRY"),
            "fixed_check_in": hotel_data.get("fixed_check_in"),
            "fixed_check_out": hotel_data.get("fixed_check_out"),
            "default_adults": hotel_data.get("default_adults", 2),
        }

        # Check if relation already exists to avoid redundant upsert
        rel_existing = (
            db.table("user_hotels")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("hotel_id", hotel_id)
            .execute()
        )

        if not rel_existing.data:
            db.table("user_hotels").insert(assoc_data).execute()
        else:
            # Update existing association with new settings if provided
            update_data = {}
            for key in [
                "is_target",
                "pricing_dna",
                "preferred_currency",
                "fixed_check_in",
                "fixed_check_out",
                "default_adults",
            ]:
                val = hotel_data.get(key if key != "is_target" else "is_target_hotel")
                if val is not None:
                    update_data[key] = val

            if update_data:
                db.table("user_hotels").update(update_data).eq(
                    "id", rel_existing.data[0]["id"]
                ).execute()

        # Update hotel_directory for collaborative growth
        try:
            db.table("hotel_directory").upsert(
                {
                    "name": existing_hotel["name"],
                    "location": existing_hotel.get("location"),
                    "latitude": existing_hotel.get("latitude"),
                    "longitude": existing_hotel.get("longitude"),
                    "rating": existing_hotel.get("rating"),
                    "review_count": existing_hotel.get("review_count"),
                    "image_url": existing_hotel.get("image_url"),
                    "phone": existing_hotel.get("phone"),
                    "email": existing_hotel.get("email"),
                    "website": existing_hotel.get("website"),
                    "address": existing_hotel.get("address"),
                    "description": existing_hotel.get("description"),
                    "cid": existing_hotel.get("cid"),
                    "place_id": existing_hotel.get("place_id"),
                    "stars": existing_hotel.get("stars"),
                    "property_token": existing_hotel.get("property_token"),
                    "serp_api_id": existing_hotel.get("serp_api_id"),
                    "last_verified_at": datetime.now().isoformat(),
                },
                on_conflict="serp_api_id",
            ).execute()
        except Exception as e:
            print(f"Directory Auto-Sync Warning: {e}")

        # Log action
        await log_query(
            db=db,
            user_id=user_id,
            hotel_name=existing_hotel["name"],
            location=existing_hotel.get("location"),
            action_type="add_to_account",
            api_key_suffix="internal",
        )

        return existing_hotel

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Add Hotel Logic Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_hotel_logic(hotel_id: UUID, user_id: UUID, db: Client) -> Dict[str, Any]:
    """
    Retrieves a hotel with user-specific overrides from user_hotels.
    """
    # Fetch merged data: Global hotel + User settings
    res = (
        db.table("user_hotels")
        .select("*, hotels(*)")
        .eq("user_id", str(user_id))
        .eq("hotel_id", str(hotel_id))
        .single()
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=404, detail="Hotel mapping for this user not found"
        )

    mapping = res.data
    hotel = mapping.get("hotels")
    if not hotel:
        raise HTTPException(status_code=404, detail="Master hotel record not found")

    # Inject user overrides
    hotel["is_target_hotel"] = mapping.get("is_target", False)
    hotel["pricing_dna"] = mapping.get("pricing_dna")
    hotel["preferred_currency"] = mapping.get("preferred_currency", "USD")
    hotel["fixed_check_in"] = mapping.get("fixed_check_in")
    hotel["fixed_check_out"] = mapping.get("fixed_check_out")
    hotel["default_adults"] = mapping.get("default_adults", 2)

    return hotel


async def update_hotel_logic(
    hotel_id: UUID, user_id: UUID, update_data: Dict[str, Any], db: Client
) -> Dict[str, Any]:
    """
    Updates user-specific hotel settings in user_hotels mappings.
    If 'is_target_hotel' is set, it clears other targets for this user.
    """
    # 1. Verify mapping exists
    mapping_res = (
        db.table("user_hotels")
        .select("id")
        .eq("user_id", str(user_id))
        .eq("hotel_id", str(hotel_id))
        .single()
        .execute()
    )
    if not mapping_res.data:
        raise HTTPException(status_code=404, detail="Hotel association not found")

    assoc_id = mapping_res.data["id"]

    # 2. Handle Target Toggle (User Specific)
    if update_data.get("is_target_hotel") is True:
        db.table("user_hotels").update({"is_target": False}).eq(
            "user_id", str(user_id)
        ).execute()
        update_data["is_target"] = True
    elif "is_target_hotel" in update_data:
        update_data["is_target"] = update_data["is_target_hotel"]

    # 3. Filter only supported override fields for user_hotels
    # These match the columns in the 'user_hotels' table
    supported_fields = [
        "is_target",
        "pricing_dna",
        "preferred_currency",
        "fixed_check_in",
        "fixed_check_out",
        "default_adults",
        "is_monitored",
    ]
    db_update = {k: v for k, v in update_data.items() if k in supported_fields}

    if db_update:
        db.table("user_hotels").update(db_update).eq("id", assoc_id).execute()

    # 4. Return the fully re-hydrated hotel object
    return await get_hotel_logic(hotel_id, user_id, db)
