from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user
from backend.models.schemas import Hotel, HotelCreate, HotelUpdate, LocationRegistry
from backend.services.hotel_service import (
    search_hotel_directory_logic,
    add_hotel_to_account_logic,
)
from backend.services.location_service import LocationService
from backend.services.profile_service import get_enriched_profile_logic
from backend.services.subscription import SubscriptionService
from backend.utils.helpers import log_query
from backend.utils.security import verify_ownership
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["hotels"])


@router.get("/v1/directory/search")
async def search_hotel_directory(
    q: str,
    user_id: Optional[UUID] = Query(None),
    city: Optional[str] = Query(None),
    db: Optional[Client] = Depends(get_supabase),
):
    """Search hotel directory (local + live callback)."""
    if not q or len(q.strip()) < 2 or not db:
        return []
    # EXPLANATION: Unified Hotel Search
    # Combines local directory lookups with a live SerpApi fallback for
    # maximum discoverability during the "Add Hotel" flow.
    return await search_hotel_directory_logic(q, user_id, db, city)
    # EXPLANATION: Search Route Enhancement
    # Added 'city' parameter to endpoints to support the frontend's
    # new smart filtering capability in the Add Hotel modal.


@router.get("/hotels/{user_id}", response_model=List[Hotel])
async def list_hotels(
    user_id: UUID,
    db: Optional[Client] = Depends(get_supabase),
    current_user=Depends(get_current_active_user),
    include_deleted: bool = False,
):
    """
    Retrieves a list of hotels associated with a specific user ID.
    Requires authentication.
    """
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


@router.post("/hotels")
async def add_hotel_to_account(
    hotel: dict,
    db: Client = Depends(get_supabase),
    current_active_user=Depends(get_current_active_user),
):
    """
    Associates a hotel from the global directory with a specific user profile.
    This triggers the initialization of tracking for that hotel.
    """
    # EXPLANATION: Hotel Onboarding
    # Bridges the global directory and the user's personal tracking list.
    # Essential for starting price monitoring for a new property.
    user_id = current_active_user.id
    return await add_hotel_to_account_logic(hotel, user_id, db)


@router.get("/hotels/search")
async def search_hotel_directory_v2(
    query: str,
    limit: int = 20,
    city: Optional[str] = Query(None),
    db: Client = Depends(get_supabase),
    current_active_user=Depends(get_current_active_user),
):
    """
    Searches the global hotel directory for a specific name or city.
    Used for onboarding new hotels to a user's account.
    Returns semantic matches even for partial strings.
    """
    return await search_hotel_directory_logic(query, None, db, city)


@router.post("/hotels/{user_id}", response_model=Hotel)
async def create_hotel(
    user_id: UUID,
    hotel: HotelCreate,
    db: Optional[Client] = Depends(get_supabase),
    current_user=Depends(get_current_active_user),
):
    """
    Logic for creating a hotel with plan-based limits and admin bypass.
    (Keeping local logic here as it depends on complex auth/plan checks in main.py)
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # EXPLANATION: Plan-Based Limit Enforcement
    # We fetch the enriched profile (which handles admin bypasses and overrides)
    # and then delegate the limit check to the SubscriptionService.

    profile = await get_enriched_profile_logic(user_id, None, db)
    can_add, reason = await SubscriptionService.check_hotel_limit(
        db, str(user_id), profile
    )

    if not can_add:
        raise HTTPException(status_code=403, detail=reason)

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

    if hotel.is_target_hotel:
        db.table("hotels").update({"is_target_hotel": False}).eq(
            "user_id", str(user_id)
        ).eq("is_target_hotel", True).execute()

    hotel_data = hotel.model_dump()
    hotel_data["name"] = hotel_data["name"].title().strip()
    if hotel_data.get("location"):
        hotel_data["location"] = hotel_data["location"].title().strip()

    result = (
        db.table("hotels").insert({"user_id": str(user_id), **hotel_data}).execute()
    )

    if result.data:
        await log_query(
            db=db,
            user_id=user_id,
            hotel_name=hotel_data["name"],
            location=hotel_data.get("location"),
            action_type="create",
        )
        # EXPLANATION: Data-Rich Auto-Sync
        # Automatically populates the global directory with high-quality metadata
        # (coordinates, ratings, images) to benefit the entire system.
        try:
            db.table("hotel_directory").upsert(
                {
                    "name": hotel_data["name"],
                    "location": hotel_data.get("location"),
                    "serp_api_id": hotel_data.get("serp_api_id"),
                    "latitude": hotel_data.get("latitude"),
                    "longitude": hotel_data.get("longitude"),
                    "rating": hotel_data.get("rating"),
                    "stars": hotel_data.get("stars"),
                    "image_url": hotel_data.get("image_url"),
                    "review_count": hotel_data.get("review_count"),
                    "last_verified_at": datetime.now().isoformat(),
                },
                on_conflict="serp_api_id",
            ).execute()
        except Exception as e:
            print(f"Directory Auto-Sync Warning: {e}")

    return result.data[0]


@router.patch("/hotels/{hotel_id}")
async def update_hotel(
    hotel_id: UUID,
    hotel: HotelUpdate,
    db: Client = Depends(get_supabase),
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
    db: Client = Depends(get_supabase),
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
