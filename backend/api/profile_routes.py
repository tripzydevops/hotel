from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from typing import Optional, Any
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.models.schemas import (
    UserProfile,
    UserProfileUpdate,
    Settings,
    SettingsUpdate,
)
from backend.services.profile_service import (
    update_profile_logic,
    get_enriched_profile_logic,
)
from datetime import datetime, timezone, timedelta
from backend.utils.security import verify_ownership
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["profile"])


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    db: Optional[Any] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Fetch user profile with enriched data."""
    user_id = current_user.id
    if not db:
        return UserProfile(
            user_id=user_id,
            display_name="Demo User",
            plan_type="enterprise",
            subscription_status="active",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    # KAIZEN: Enforce ownership to prevent ID harvesting
    verify_ownership(user_id, current_user)

    try:
        # Cast to UUID
        user_uuid = UUID(str(user_id)) if isinstance(user_id, str) else user_id
        
        return await get_enriched_profile_logic(
            user_uuid, None, db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/profile", response_model=UserProfile)
async def update_profile(
    profile: UserProfileUpdate,
    db: Optional[Any] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Update user profile (upsert)."""
    user_id = current_user.id
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # KAIZEN: Enforce ownership
    verify_ownership(user_id, current_user)

    try:
        # Cast to UUID
        user_uuid = UUID(str(user_id)) if isinstance(user_id, str) else user_id
        
        return await update_profile_logic(user_uuid, profile, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings", response_model=Settings)
async def get_settings(
    db: Optional[Any] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Retrieves user-specific application settings (alert thresholds, scan frequency).
    If no settings exist, it initializes them with safe defaults.
    """
    user_id = current_user.id
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # KAIZEN: Enforce ownership
    verify_ownership(user_id, current_user)

    # EXPLANATION: Application Configuration
    # Handles persistence of user preferences, including parity alert sensitivity
    # and automatic scan frequency (e.g., Every 4 hours).
    now = datetime.now(timezone.utc)
    # ... logic remains same ...
    safe_defaults = {
        "user_id": str(user_id),
        "threshold_percent": 2.0,
        "check_frequency_minutes": 144,
        "notifications_enabled": True,
        "push_enabled": False,
        "currency": "USD",
        "dynamic_threshold_enabled": False,
        "dynamic_threshold_sensitivity": 1.0,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
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
                "currency": "USD",
                "dynamic_threshold_enabled": False,
                "dynamic_threshold_sensitivity": 1.0,
            }
            result = db.table("settings").insert(insert_data).execute()
            # Return fresh data
            return result.data[0]
        
        # KAİZEN: Handle missing or None fields for Pydantic validation safety
        # Merge database results with safe defaults to ensure required fields aren't None
        settings_data = result.data[0]
        for key, val in safe_defaults.items():
            if settings_data.get(key) is None:
                settings_data[key] = val
        
        return settings_data
    except Exception as e:
        print(f"Error in get_settings: {e}")
        return safe_defaults


@router.put("/settings", response_model=Settings)
async def update_settings(
    settings: SettingsUpdate,
    db: Optional[Any] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Persists user settings updates.
    Handles both creation (first-time) and modification.
    """
    user_id = current_user.id
    if not db:
        # Fallback for local/demo mode
        return {
            "user_id": str(user_id),
            "threshold_percent": settings.threshold_percent or 2.0,
            "check_frequency_minutes": settings.check_frequency_minutes
            if settings.check_frequency_minutes is not None
            else 144,
            "notifications_enabled": settings.notifications_enabled
            if settings.notifications_enabled is not None
            else True,
            "push_enabled": settings.push_enabled
            if settings.push_enabled is not None
            else False,
            "currency": settings.currency or "USD",
            "dynamic_threshold_enabled": settings.dynamic_threshold_enabled
            if settings.dynamic_threshold_enabled is not None
            else False,
            "dynamic_threshold_sensitivity": settings.dynamic_threshold_sensitivity
            if settings.dynamic_threshold_sensitivity is not None
            else 1.0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    existing = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
    update_data = settings.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if existing.data:
        # KAİZEN: Handle schema mismatch for optional fields
        if (
            "push_subscription" in update_data
            and update_data["push_subscription"] is None
        ):
            del update_data["push_subscription"]

        try:
            result = (
                db.table("settings")
                .update(update_data)
                .eq("user_id", str(user_id))
                .execute()
            )
            
            # 3.5 [KAIZEN] Initialize/Update next_scan_at in profiles
            # Why: If the user changes their frequency (timer), the scheduler needs to know.
            # Especially for new users where next_scan_at is NULL (Safe/Lean Mode).
            if "check_frequency_minutes" in update_data:
                freq = update_data["check_frequency_minutes"]
                # We update next_scan_at to now() + freq
                new_next = (datetime.now(timezone.utc) + timedelta(minutes=freq)).isoformat().replace("+00:00", "Z")
                db.table("profiles").update({"next_scan_at": new_next}).eq("id", str(user_id)).execute()
        except Exception as e:
            # If update fails (e.g. column missing), try fallback without push_subscription
            if "push_subscription" in update_data:
                del update_data["push_subscription"]
                result = (
                    db.table("settings")
                    .update(update_data)
                    .eq("user_id", str(user_id))
                    .execute()
                )
            else:
                raise e
    else:
        # Insert new
        if (
            "push_subscription" in update_data
            and update_data["push_subscription"] is None
        ):
            del update_data["push_subscription"]
        try:
            result = (
                db.table("settings")
                .insert({"user_id": str(user_id), **update_data})
                .execute()
            )
        except Exception as e:
            if "push_subscription" in update_data:
                del update_data["push_subscription"]
                result = (
                    db.table("settings")
                    .insert({"user_id": str(user_id), **update_data})
                    .execute()
                )
            else:
                raise e

    # KAİZEN: Synchronize next_scan_at if frequency changed
    if "check_frequency_minutes" in update_data:
        try:
            freq = update_data["check_frequency_minutes"]
            now_dt = datetime.now(timezone.utc).replace(microsecond=0)
            next_run = (
                (now_dt + timedelta(minutes=freq)).isoformat().replace("+00:00", "Z")
            )
            db.table("profiles").update({"next_scan_at": next_run}).eq(
                "id", str(user_id)
            ).execute()
            print(f"[Settings] Synced next_scan_at for {user_id} to {next_run}")
        except Exception as e:
            print(f"[Settings] Profile sync failed: {e}")

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update settings")
    return result.data[0]
