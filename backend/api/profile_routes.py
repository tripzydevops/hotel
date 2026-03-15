from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from typing import Optional
from supabase import Client
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

router = APIRouter(prefix="/api", tags=["profile"])


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    user_id: Optional[str] = None,
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    effective_user_id = user_id if user_id else current_user.id
    
    # KAIZEN: Enforce ownership, but allow admins to bypass if user_id is provided
    is_admin = getattr(current_user, "role", "").lower() in ["admin", "market_admin", "market admin"]
    if user_id and not is_admin:
         raise HTTPException(status_code=403, detail="Impersonation restricted to admins")
         
    if not user_id:
        verify_ownership(effective_user_id, current_user)

    try:
        return await get_enriched_profile_logic(
            effective_user_id, None, db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/profile", response_model=UserProfile)
async def update_profile(
    profile: UserProfileUpdate,
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Update user profile (upsert)."""
    user_id = current_user.id
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # KAIZEN: Enforce ownership
    verify_ownership(user_id, current_user)

    try:
        return await update_profile_logic(user_id, profile, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings", response_model=Settings)
async def get_settings(
    db: Optional[Client] = Depends(get_supabase_rls),
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
            }
            result = db.table("settings").insert(insert_data).execute()
            return result.data[0]
        return result.data[0]
    except Exception as e:
        print(f"Error in get_settings: {e}")
        return safe_defaults


@router.put("/settings", response_model=Settings)
async def update_settings(
    settings: SettingsUpdate,
    db: Optional[Client] = Depends(get_supabase_rls),
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
