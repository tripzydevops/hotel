from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.models.schemas import Hotel, HotelCreate, HotelUpdate, LocationRegistry
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.services.hotel_service import (
    add_hotel_to_account_logic,
    search_hotel_directory_logic,
    update_hotel_logic,
)
from backend.services.location_service import LocationService
from backend.services.profile_service import get_enriched_profile_logic
from backend.services.subscription import SubscriptionService
from backend.utils.db import get_supabase
from supabase import Client

# Routing Normalization
# Prefix is registered centrally in main.py.
router = APIRouter(tags=["hotels"])


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
    # Unified Hotel Search (Public Access)
    return await search_hotel_directory_logic(q, user_id, db, city)


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

    # Query via user_hotels mapping to support shared hotel architecture
    # This join pulls user-specific overrides from user_hotels + master hotel data
    res = (
        db.table("user_hotels")
        .select("*, hotels(*)")
        .eq("user_id", str(user_id))
        .execute()
    )
    data = res.data or []

    all_hotels = []
    for mapping in data:
        hotel = mapping.get("hotels")
        if hotel and (include_deleted or not hotel.get("deleted_at")):
            # Inject user-specific overrides
            hotel["is_target_hotel"] = mapping.get("is_target", False)
            hotel["pricing_dna"] = mapping.get("pricing_dna")
            hotel["preferred_currency"] = mapping.get("preferred_currency", "USD")
            hotel["fixed_check_in"] = mapping.get("fixed_check_in")
            hotel["fixed_check_out"] = mapping.get("fixed_check_out")
            hotel["default_adults"] = mapping.get("default_adults", 2)
            all_hotels.append(hotel)

    return all_hotels


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
    admin_db: Client = Depends(lambda: get_supabase(admin=True)),
    current_user=Depends(get_current_active_user),
):
    """
    Creates a hotel with plan-based limits, profile self-healing, and
    token discovery via the unified service layer.

    AGENT_FIX: Migration Logic (March 2026)
    Previously this route did a raw db.table("hotels").insert(),
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

    # STEP 2: Normalize and delegate to service layer
    # The service layer handles: duplicate detection, target hotel toggling,
    # token discovery from hotel_directory, and user association via user_hotels.
    hotel_data = hotel.model_dump()
    hotel_data["name"] = hotel_data["name"].title().strip()
    if hotel_data.get("location"):
        hotel_data["location"] = hotel_data["location"].title().strip()

    result = await add_hotel_to_account_logic(hotel_data, user_id, db, admin_db=admin_db)
    return result


@router.patch("/hotels/{hotel_id}")
async def update_hotel(
    hotel_id: UUID,
    hotel: HotelUpdate,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    # AGENT_FIX: Use unified service logic for multi-tenant updates
    # This ensures settings like 'is_target_hotel' or 'pricing_dna' are
    # saved to the user_hotels table, not the global shared hotels record.
    return await update_hotel_logic(
        hotel_id, current_user.id, hotel.model_dump(exclude_unset=True), db
    )


@router.delete("/hotels/{hotel_id}")
async def delete_hotel(
    hotel_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    # AGENT_FIX: Soft-delete for unique user association
    # We remove the mapping from user_hotels but keep the master hotel record intact.
    # The 'deleted_at' on the master record is only used by admins or if it was the last user.
    res = (
        db.table("user_hotels")
        .delete()
        .eq("user_id", str(current_user.id))
        .eq("hotel_id", str(hotel_id))
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Hotel association not found")

    return {
        "status": "removed",
        "message": "Hotel successfully removed from your account",
    }
