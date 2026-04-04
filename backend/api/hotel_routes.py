from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.utils.db import get_supabase
from backend.models.schemas import Hotel, HotelCreate, HotelUpdate, LocationRegistry
from backend.services.hotel_service import (
    search_hotel_directory_logic,
    add_hotel_to_account_logic,
)
from backend.services.location_service import LocationService
from backend.services.profile_service import get_enriched_profile_logic
from backend.services.subscription import SubscriptionService
from backend.utils.security import verify_ownership
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["hotels"])


@router.get("/v1/directory/search")
async def search_hotel_directory(
    q: str,
    user_id: Optional[UUID] = Query(None),
    city: Optional[str] = Query(None),
    db: Client = Depends(get_supabase),
):
    """Search hotel directory (local + live callback). No auth required."""
    if not q or len(q.strip()) < 2:
        return []
    # EXPLANATION: Unified Hotel Search (Public Access)
    # This endpoint is public to support the "Add Hotel" discovery flow
    # without requiring a session for initial searching.
    return await search_hotel_directory_logic(q, user_id, db, city)
    # EXPLANATION: Search Route Enhancement
    # Added 'city' parameter to endpoints to support the frontend's
    # new smart filtering capability in the Add Hotel modal.


@router.get("/hotels", response_model=List[Hotel])
async def list_hotels(
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
    include_deleted: bool = False,
):
    """
    Retrieves a list of hotels associated with the current user.
    """
    user_id = current_user.id
    if not db:
        return []
    # EXPLANATION: User Property List (Soft-Delete Aware)
    # Powers the sidebar and dashboard selector. By default, it hides
    # archived hotels to prevent cluttering the UI.
    query = db.table("hotels").select("*").eq("user_id", str(user_id))
    if not include_deleted:
        query = query.is_("deleted_at", "null")

    result = query.execute()
    return result.data or []


@router.get("/locations", response_model=List[LocationRegistry])
async def list_locations(db: Client = Depends(get_supabase)):
    """Fetch all discovered locations for the dropdowns."""
    if not db:
        return []
    service = LocationService(db)
    return await service.get_locations()



@router.get("/hotels/search")
async def search_hotel_directory_v2(
    query: str,
    limit: int = 20,
    city: Optional[str] = Query(None),
    db: Client = Depends(get_supabase_rls),
    current_active_user=Depends(get_current_active_user),
):
    """
    Searches the global hotel directory for a specific name or city.
    Used for onboarding new hotels to a user's account.
    Returns semantic matches even for partial strings.
    """
    return await search_hotel_directory_logic(query, None, db, city)


@router.post("/hotels", response_model=Hotel)
async def create_hotel(
    hotel: HotelCreate,
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Creates a hotel with plan-based limits, profile self-healing, and
    token discovery via the unified service layer.

    FIX (March 2026): Previously this route did a raw db.table("hotels").insert(),
    which bypassed token discovery and left hotels without property_token/serp_api_id.
    The cleanup script then deleted them as "orphans". Now we delegate to
    add_hotel_to_account_logic which handles enrichment, directory sync, and logging.
    """
    user_id = current_user.id
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # STEP 1: Profile Self-Healing & Plan Check
    # get_enriched_profile_logic creates the user_profiles row if missing.
    # This is CRITICAL: without a user_profiles entry, the cleanup script
    # treats ALL of this user's hotels as unprotected orphans.
    profile = await get_enriched_profile_logic(user_id, None, db)
    can_add, reason = await SubscriptionService.check_hotel_limit(
        db, str(user_id), profile
    )

    if not can_add:
        raise HTTPException(status_code=403, detail=reason)

    # STEP 2: Duplicate Detection (fast-path before service layer)
    if hotel.serp_api_id:
        dup = (
            db.table("hotels")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("serp_api_id", hotel.serp_api_id)
            .execute()
        )
        if dup.data:
            return dup.data[0]

    # STEP 3: Target Hotel Toggle (only one target per user)
    if hotel.is_target_hotel:
        db.table("hotels").update({"is_target_hotel": False}).eq(
            "user_id", str(user_id)
        ).eq("is_target_hotel", True).execute()

    # STEP 4: Normalize and delegate to service layer
    # The service layer handles: token discovery from hotel_directory,
    # property_token/serp_api_id enrichment, db insert, logging, and directory sync.
    hotel_data = hotel.model_dump()
    hotel_data["name"] = hotel_data["name"].title().strip()
    if hotel_data.get("location"):
        hotel_data["location"] = hotel_data["location"].title().strip()

    result = await add_hotel_to_account_logic(hotel_data, user_id, db)
    return result


@router.patch("/hotels/{hotel_id}")
async def update_hotel(
    hotel_id: UUID,
    hotel: HotelUpdate,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    # KAIZEN: Ownership Verification for specific resource
    try:
        current_res = (
            db.table("hotels")
            .select("user_id")
            .eq("id", str(hotel_id))
            .single()
            .execute()
        )
        if not current_res.data:
            raise HTTPException(status_code=404, detail="Hotel not found")
        verify_ownership(current_res.data["user_id"], current_user)
    except HTTPException as he:
        raise he
    except Exception:
        raise HTTPException(status_code=500, detail="Ownership check failed")

    update_data = {k: v for k, v in hotel.model_dump().items() if v is not None}
    if not update_data:
        return None

    if update_data.get("is_target_hotel"):
        uid = current_res.data["user_id"]
        db.table("hotels").update({"is_target_hotel": False}).eq(
            "user_id", uid
        ).execute()

    result = db.table("hotels").update(update_data).eq("id", str(hotel_id)).execute()
    return result.data[0] if result.data else None


@router.delete("/hotels/{hotel_id}")
async def delete_hotel(
    hotel_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    # KAIZEN: Ownership Verification
    try:
        current_res = (
            db.table("hotels")
            .select("user_id")
            .eq("id", str(hotel_id))
            .single()
            .execute()
        )
        if not current_res.data:
            raise HTTPException(status_code=404, detail="Hotel not found")
        verify_ownership(current_res.data["user_id"], current_user)
    except HTTPException as he:
        raise he
    except Exception:
        raise HTTPException(status_code=500, detail="Ownership check failed")

    # EXPLANATION: Accidental Deletion Prevention
    # Instead of a hard DELETE, we set 'deleted_at'. This preserves
    # historical price_logs and allows for easy data recovery if needed.
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    db.table("hotels").update({"deleted_at": now_iso}).eq("id", str(hotel_id)).execute()
    return {"status": "archived", "message": "Hotel successfully archived"}
