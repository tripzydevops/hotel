"""
Admin — Directory & Profile Sync Management
=============================================
Handles sync operations between local hotel profiles and external
directory sources (OTA listings, Google Business, etc.).

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_sync_status_logic(db: Client) -> Dict[str, Any]:
    """
    Return aggregated sync status across all hotels.
    Shows last_synced timestamps, pending count, and error count.
    """
    try:
        res = (
            db.table("hotel_sync_status")
            .select("*")
            .order("last_synced_at", desc=True)
            .execute()
        )
        rows = res.data or []

        total = len(rows)
        synced = sum(1 for r in rows if r.get("status") == "synced")
        pending = sum(1 for r in rows if r.get("status") == "pending")
        errored = sum(1 for r in rows if r.get("status") == "error")

        return {
            "total": total,
            "synced": synced,
            "pending": pending,
            "errored": errored,
            "items": rows[:50],  # Cap UI payload
        }
    except PostgRESTError as e:
        logger.warning(f"hotel_sync_status table not available: {e}")
        return {"total": 0, "synced": 0, "pending": 0, "errored": 0, "items": []}


async def trigger_sync_logic(
    db: Client,
    hotel_id: Optional[UUID] = None,
    source: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Trigger a sync operation.
    - If hotel_id is provided, sync only that hotel.
    - If source is provided ("booking", "google", etc.), sync that source.
    - Otherwise, trigger a full sync.
    """
    try:
        payload: Dict[str, Any] = {
            "action": "sync",
            "status": "pending",
        }
        if hotel_id:
            payload["hotel_id"] = str(hotel_id)
        if source:
            payload["source"] = source

        res = db.table("sync_jobs").insert(payload).execute()
        job = res.data[0] if res.data else payload

        logger.info(
            f"Sync job queued: hotel_id={hotel_id}, source={source}, "
            f"job_id={job.get('id', 'unknown')}"
        )
        return {"status": "queued", "job": job}
    except PostgRESTError as e:
        logger.error(f"PostgREST error queuing sync job: {e}", exc_info=True)
        raise HTTPException(500, f"Sync trigger failed: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Data error queuing sync job: {e}", exc_info=True)
        raise HTTPException(500, f"Sync trigger failed: {e}")


async def get_sync_history_logic(
    db: Client,
    hotel_id: Optional[UUID] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Return sync history (most recent first).
    Optionally filtered by hotel_id.
    """
    try:
        query = db.table("sync_jobs").select("*").order("created_at", desc=True).limit(limit)

        if hotel_id:
            query = query.eq("hotel_id", str(hotel_id))

        res = query.execute()
        return res.data or []
    except PostgRESTError as e:
        logger.warning(f"sync_jobs table not available: {e}")
        return []


async def resolve_sync_conflict_logic(
    db: Client,
    conflict_id: UUID,
    resolution: str,  # "keep_local" | "keep_remote" | "merge"
) -> Dict[str, Any]:
    """
    Resolve a sync conflict entry by marking the chosen resolution.
    """
    valid_resolutions = {"keep_local", "keep_remote", "merge"}
    if resolution not in valid_resolutions:
        raise HTTPException(
            422, f"Invalid resolution '{resolution}'. Must be one of {valid_resolutions}"
        )

    try:
        res = (
            db.table("sync_conflicts")
            .update({"resolution": resolution, "status": "resolved"})
            .eq("id", str(conflict_id))
            .execute()
        )
        if not res.data:
            raise HTTPException(404, f"Sync conflict {conflict_id} not found")
        return res.data[0]
    except HTTPException:
        raise
    except PostgRESTError as e:
        logger.error(f"PostgREST error resolving sync conflict {conflict_id}: {e}", exc_info=True)
        raise HTTPException(500, f"Database error: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Data error resolving sync conflict {conflict_id}: {e}", exc_info=True)
        raise HTTPException(500, str(e))


async def get_directory_profiles_logic(
    db: Client,
    hotel_id: UUID,
) -> List[Dict[str, Any]]:
    """
    Return external directory profiles linked to a hotel.
    """
    try:
        res = (
            db.table("directory_profiles")
            .select("*")
            .eq("hotel_id", str(hotel_id))
            .execute()
        )
        return res.data or []
    except PostgRESTError as e:
        logger.warning(f"directory_profiles query failed for hotel {hotel_id}: {e}")
        return []


async def sync_hotel_directory_logic(db: Client) -> Dict[str, Any]:
    """
    Consolidated logic to sync active hotels into the global directory.
    Replaces fragmented backfill_*.py scripts.
    KAIZEN: Bi-directional Token Correction (Phase 1.1)
    """
    try:
        # 1. Fetch all hotels from active 'hotels' table
        hotels_res = db.table("hotels").select("*").execute()
        active_hotels = hotels_res.data or []

        synced_count = 0
        updated_count = 0
        token_backfills = 0

        for hotel in active_hotels:
            serp_id = hotel.get("serp_api_id")
            hid = hotel["id"]

            # Check if already in directory (by SerpApi ID or exact name+location)
            existing = None
            if serp_id:
                existing_res = (
                    db.table("hotel_directory")
                    .select("*")
                    .eq("serp_api_id", serp_id)
                    .execute()
                )
                existing = existing_res.data[0] if existing_res.data else None

            if not existing:
                existing_res = (
                    db.table("hotel_directory")
                    .select("*")
                    .eq("name", hotel["name"])
                    .eq("location", hotel["location"])
                    .execute()
                )
                existing = existing_res.data[0] if existing_res.data else None

            dir_data = {
                "name": hotel["name"],
                "location": hotel["location"],
                "serp_api_id": serp_id,
                "rating": hotel.get("rating"),
                "stars": hotel.get("stars"),
                "image_url": hotel.get("image_url"),
                "latitude": hotel.get("latitude"),
                "longitude": hotel.get("longitude"),
                "amenities": hotel.get("amenities", []),
                "images": hotel.get("images", []),
                "description": hotel.get("description"),
                "address": hotel.get("address"),
                "phone": hotel.get("phone"),
                "email": hotel.get("email"),
                "website": hotel.get("website"),
                "cid": hotel.get("cid"),
                "place_id": hotel.get("place_id"),
                "property_token": hotel.get("property_token"),
                "review_count": hotel.get("review_count", 0),
                "reviews": hotel.get("reviews", []),
                "sentiment_breakdown": hotel.get("sentiment_breakdown", {}),
                "location_code": hotel.get("location_code"),
                "resolved_location_name": hotel.get("resolved_location_name"),
                "location_verified": hotel.get("location_verified", False),
            }

            if existing:
                db.table("hotel_directory").update(dir_data).eq(
                    "id", existing["id"]
                ).execute()
                updated_count += 1

                # KAIZEN: Re-align hotel token if directory has a better one
                dir_serp_id = existing.get("serp_api_id")
                if dir_serp_id and dir_serp_id != serp_id:
                    db.table("hotels").update({"serp_api_id": dir_serp_id}).eq(
                        "id", hid
                    ).execute()
                    token_backfills += 1
            else:
                db.table("hotel_directory").insert(dir_data).execute()
                synced_count += 1

        return {
            "status": "success",
            "hotels_processed": len(active_hotels),
            "new_entries": synced_count,
            "updated_entries": updated_count,
            "token_corrections": token_backfills,
        }
    except PostgRESTError as e:
        logger.error(f"PostgREST error during directory sync: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except KeyError as e:
        logger.error(f"Missing required field during directory sync: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")


async def sync_user_profiles_logic(db: Client) -> Dict[str, Any]:
    """
    Ensures 'profiles' table (Modern) is in sync with 'user_profiles' (Legacy/Internal).
    Migrates missing users and updates stale metadata.
    """
    try:
        user_profiles_res = db.table("user_profiles").select("*").execute()
        user_profiles = user_profiles_res.data or []

        profiles_res = db.table("profiles").select("*").execute()
        profiles = profiles_res.data or []
        profile_ids = {str(p["id"]) for p in profiles}

        synced_count = 0
        updated_count = 0

        for up in user_profiles:
            uid = str(up["user_id"])

            p_data = {
                "id": uid,
                "email": up.get("email"),
                "display_name": up.get("display_name"),
                "company_name": up.get("company_name"),
                "job_title": up.get("job_title"),
                "phone": up.get("phone"),
                "timezone": up.get("timezone", "UTC"),
                "role": up.get("role", "user"),
                "plan_type": up.get("plan_type", "trial"),
                "subscription_status": up.get("subscription_status", "trial"),
            }

            if uid not in profile_ids:
                db.table("profiles").insert(p_data).execute()
                synced_count += 1
            else:
                db.table("profiles").update(p_data).eq("id", uid).execute()
                updated_count += 1

        return {
            "status": "success",
            "processed": len(user_profiles),
            "created": synced_count,
            "updated": updated_count,
        }
    except PostgRESTError as e:
        logger.error(f"PostgREST error during profile sync: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except KeyError as e:
        logger.error(f"Missing required field during profile sync: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")


async def sync_all_logic(db: Client) -> Dict[str, Any]:
    """
    KAIZEN: Unified Sync (Phase 1.2)
    Triggers both directory and profile synchronization.
    """
    hotel_res = await sync_hotel_directory_logic(db)
    profile_res = await sync_user_profiles_logic(db)

    return {
        "status": "success",
        "directory": hotel_res,
        "profiles": profile_res,
    }


async def cleanup_test_data_logic(db: Client) -> Dict[str, Any]:
    """
    Removes test records and artifacts from the system.
    SAFEGUARD: Price logs are NOT deleted — historical data is preserved.
    """
    try:
        test_hotels = db.table("hotels").select("id").ilike("name", "%test%").execute()
        hotel_ids = [h["id"] for h in (test_hotels.data or [])]

        if hotel_ids:
            db.table("alerts").delete().in_("hotel_id", hotel_ids).execute()
            db.table("hotels").delete().in_("id", hotel_ids).execute()

        logger.info(f"Test data cleanup: deleted {len(hotel_ids)} hotels")
        return {"status": "success", "deleted_count": len(hotel_ids)}
    except PostgRESTError as e:
        logger.error(f"PostgREST error during cleanup: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except KeyError as e:
        logger.error(f"Data access error during cleanup: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")
