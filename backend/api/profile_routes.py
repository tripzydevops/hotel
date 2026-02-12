from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from typing import Optional
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user  # noqa: F401
from backend.models.schemas import UserProfile, UserProfileUpdate, Settings, SettingsUpdate
from backend.services.profile_service import update_profile_logic, get_enriched_profile_logic
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["profile"])

@router.get("/profile/{user_id}", response_model=UserProfile)
async def get_profile(user_id: UUID, db: Optional[Client] = Depends(get_supabase)):
    """Fetch user profile with enriched data."""
    if not db:
        return UserProfile(
            user_id=user_id,
            display_name="Demo User",
            plan_type="enterprise",
            subscription_status="active",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
    result = db.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
    base_data = result.data[0] if result.data else None
    return await get_enriched_profile_logic(user_id, base_data, db)

@router.put("/profile/{user_id}", response_model=UserProfile)
async def update_profile(user_id: UUID, profile: UserProfileUpdate, db: Optional[Client] = Depends(get_supabase)):
    """Update user profile (upsert)."""
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        return await update_profile_logic(user_id, profile, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/settings/{user_id}", response_model=Settings)
async def get_settings(user_id: UUID, db: Optional[Client] = Depends(get_supabase)):
    """
    Retrieves user-specific application settings (alert thresholds, scan frequency).
    If no settings exist, it initializes them with safe defaults.
    """
    now = datetime.now(timezone.utc)
    # ... logic remains same ...
    safe_defaults = {
        "user_id": str(user_id),
        "threshold_percent": 2.0,
        "check_frequency_minutes": 144,
        "notifications_enabled": True,
        "push_enabled": False,
        "currency": "USD",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    try:
        if not db:
            return safe_defaults
        result = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
        if not result.data:
            insert_data = {
                "user_id": str(user_id),
                "threshold_percent": 2.0,
                "check_frequency_minutes": 1440,
                "notifications_enabled": True,
                "push_enabled": False,
                "currency": "USD"
            }
            result = db.table("settings").insert(insert_data).execute()
            return result.data[0]
        return result.data[0]
    except Exception as e:
        print(f"Error in get_settings: {e}")
        return safe_defaults

@router.put("/settings/{user_id}", response_model=Settings)
async def update_settings(user_id: UUID, settings: SettingsUpdate, db: Optional[Client] = Depends(get_supabase)):
    """
    Persists user settings updates. 
    Handles both creation (first-time) and modification.
    """
    if not db:
        # Fallback for local/demo mode
        return {
            "user_id": str(user_id),
            "threshold_percent": settings.threshold_percent or 2.0,
            "check_frequency_minutes": settings.check_frequency_minutes if settings.check_frequency_minutes is not None else 144,
            "notifications_enabled": settings.notifications_enabled if settings.notifications_enabled is not None else True,
            "push_enabled": settings.push_enabled if settings.push_enabled is not None else False,
            "currency": settings.currency or "USD",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    existing = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
    update_data = settings.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if not existing.data:
        result = db.table("settings").insert({"user_id": str(user_id), **update_data}).execute()
    else:
        result = db.table("settings").update(update_data).eq("user_id", str(user_id)).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update settings")
    return result.data[0]
