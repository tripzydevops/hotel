from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user
from backend.models.schemas import (
    Hotel, HotelCreate, HotelUpdate, LocationRegistry
)
from backend.services.hotel_service import (
    search_hotel_directory_logic, 
    add_hotel_to_account_logic
)
from backend.services.location_service import LocationService
from backend.utils.helpers import log_query
from datetime import datetime

router = APIRouter(prefix="/api", tags=["hotels"])

@router.get("/v1/directory/search")
async def search_hotel_directory(
    q: str, 
    user_id: Optional[UUID] = Query(None), 
    city: Optional[str] = Query(None),
    db: Optional[Client] = Depends(get_supabase)
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
async def list_hotels(user_id: UUID, db: Optional[Client] = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """
    Retrieves a list of hotels associated with a specific user ID.
    Requires authentication.
    """
    if not db:
        return []
    # EXPLANATION: User Property List
    # Powers the sidebar and dashboard selector for switching between properties.
    result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
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
    current_active_user = Depends(get_current_active_user)
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
    current_active_user = Depends(get_current_active_user)
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
    current_user = Depends(get_current_active_user)
):
    """
    Logic for creating a hotel with plan-based limits and admin bypass.
    (Keeping local logic here as it depends on complex auth/plan checks in main.py)
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    limit = 1 # Default
    
    # Check Admin Status
    is_admin = False
    email = getattr(current_user, 'email', None)
    if email:
        email_lower = email.lower()
        if (email_lower in ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com", "askinsezen@gmail.com", "yusuf@tripzy.travel", "elif@tripzy.travel"] 
            or email_lower.endswith("@hotel.plus")):
            is_admin = True
            
    if not is_admin:
        try:
            profile_res = db.table("user_profiles").select("role").eq("user_id", str(user_id)).execute()
            if profile_res.data and profile_res.data[0].get("role") and profile_res.data[0].get("role").lower() in ["admin", "market_admin", "market admin"]:
                is_admin = True
        except Exception:
            pass

    if is_admin or str(user_id) == "eb284dd9-7198-47be-acd0-fdb0403bcd0a":
        limit = 999
    else:
        plan = "trial"
        try:
            profiles_res = db.table("profiles").select("plan_type").eq("id", str(user_id)).execute()
            if profiles_res.data and profiles_res.data[0].get("plan_type"):
                plan = profiles_res.data[0].get("plan_type")
            else:
                user_profiles_res = db.table("user_profiles").select("plan_type").eq("user_id", str(user_id)).execute()
                if user_profiles_res.data:
                    plan = user_profiles_res.data[0].get("plan_type", "trial")
            
            PLAN_LIMITS = {
                "trial": 1, "starter": 5, "pro": 25, "professional": 25, "enterprise": 999
            }
            limit = PLAN_LIMITS.get(plan, 1)
        except Exception as e:
            print(f"Plan check failed: {e}")

    existing = db.table("hotels").select("id").eq("user_id", str(user_id)).execute()
    if existing.data and len(existing.data) >= limit:
        raise HTTPException(status_code=403, detail=f"Hotel limit reached (Max {limit}).")
        
    if hotel.serp_api_id:
        dup = db.table("hotels").select("*").eq("user_id", str(user_id)).eq("serp_api_id", hotel.serp_api_id).execute()
        if dup.data:
            return dup.data[0]

    if hotel.is_target_hotel:
        db.table("hotels").update({"is_target_hotel": False}).eq("user_id", str(user_id)).eq("is_target_hotel", True).execute()
    
    hotel_data = hotel.model_dump()
    hotel_data["name"] = hotel_data["name"].title().strip()
    if hotel_data.get("location"):
        hotel_data["location"] = hotel_data["location"].title().strip()

    result = db.table("hotels").insert({"user_id": str(user_id), **hotel_data}).execute()
    
    if result.data:
        await log_query(
            db=db, 
            user_id=user_id, 
            hotel_name=hotel_data["name"], 
            location=hotel_data.get("location"),
            action_type="create"
        )
        # EXPLANATION: Data-Rich Auto-Sync
        # Automatically populates the global directory with high-quality metadata 
        # (coordinates, ratings, images) to benefit the entire system.
        try:
            db.table("hotel_directory").upsert({
                "name": hotel_data["name"],
                "location": hotel_data.get("location"),
                "serp_api_id": hotel_data.get("serp_api_id"),
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

@router.patch("/hotels/{hotel_id}")
async def update_hotel(hotel_id: UUID, hotel: HotelUpdate, db: Client = Depends(get_supabase)):
    update_data = {k: v for k, v in hotel.model_dump().items() if v is not None}
    if not update_data:
        return None

    if update_data.get("is_target_hotel"):
        try:
            current_res = db.table("hotels").select("user_id").eq("id", str(hotel_id)).single().execute()
            if current_res.data:
                uid = current_res.data["user_id"]
                db.table("hotels").update({"is_target_hotel": False}).eq("user_id", uid).execute()
        except Exception:
            pass

    result = db.table("hotels").update(update_data).eq("id", str(hotel_id)).execute()
    return result.data[0] if result.data else None

@router.delete("/hotels/{hotel_id}")
async def delete_hotel(hotel_id: UUID, db: Client = Depends(get_supabase)):
    db.table("hotels").delete().eq("id", str(hotel_id)).execute()
    return {"status": "deleted"}
