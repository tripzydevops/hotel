from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.utils.logger import get_logger

logger = get_logger(__name__)

from backend.models.schemas import (
    Settings,
    SettingsUpdate,
    UserProfile,
    UserProfileUpdate,
)
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.services.profile_service import (
    get_enriched_profile_logic,
    update_profile_logic,
    export_user_data_dsar,
    purge_user_data_dsar,
)
from backend.utils.security import verify_ownership
from supabase import Client


# ── GDPR / KVKK Request Models ──


class ConsentRequest(BaseModel):
    """Request body for the consent recording endpoint."""
    accepted: bool

# EXPLANATION: Routing Normalization (Regression Fix)
# Removed "/api" prefix from APIRouter to avoid doubled paths
# (e.g., /api/api/profile/...) when registered in main.py.
router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    db: Optional[Client] = Depends(get_supabase_rls),
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
            user_uuid, None, db, email=getattr(current_user, "email", None)
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
        # Cast to UUID
        user_uuid = UUID(str(user_id)) if isinstance(user_id, str) else user_id

        return await update_profile_logic(
            user_uuid, profile, db, email=getattr(current_user, "email", None)
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is (preserves specific status codes from service layer)
        raise
    except Exception as e:
        logger.error(f"[Profile Route] Unhandled error updating profile for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")



@router.get("/settings", response_model=Settings)
async def get_settings(
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Retrieves user-specific application settings (alert thresholds, notifications).
    If no settings exist, it initializes them with safe defaults.
    """
    user_id = current_user.id
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # KAIZEN: Enforce ownership
    verify_ownership(user_id, current_user)

    # EXPLANATION: Application Configuration
    # Handles persistence of user preferences, including parity alert sensitivity.
    now = datetime.now(timezone.utc)
    # ... logic remains same ...
    safe_defaults = {
        "user_id": str(user_id),
        "threshold_percent": 2.0,
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
        if not result or not result.data:
            insert_data = {
                "user_id": str(user_id),
                "threshold_percent": 2.0,
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
        logger.error(f"Error in get_settings: {e}")
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

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update settings")
    return result.data[0]


# ═══════════════════════════════════════════════════════════════════════
# GDPR / KVKK — Data Subject Access Request (DSAR) Endpoints
# ═══════════════════════════════════════════════════════════════════════


@router.get("/profile/dsar/export")
async def dsar_export(
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    GDPR Article 15 / KVKK Article 11 — Data Subject Access Request (Export).

    Returns a comprehensive JSON export of all personal data the platform
    holds for the authenticated user. Includes profile, settings, hotel
    associations, and alerts. Excludes aggregated pricing/scan data which
    is classified as business intelligence.
    """
    user_id = current_user.id

    # Ownership verification: users can only export their own data
    verify_ownership(user_id, current_user)

    try:
        return await export_user_data_dsar(str(user_id), db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DSAR Export] Unhandled error for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to export user data")


@router.delete("/profile/dsar/purge")
async def dsar_purge(
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    GDPR Article 17 / KVKK Article 7 — Right to Erasure ("Right to be Forgotten").

    Permanently deletes all personal data for the authenticated user:
      - Anonymizes scan_sessions and query_logs (preserves business intelligence)
      - Hard deletes alerts, user_hotels, settings, and user_profiles
      - Removes the InsForge/Supabase auth record

    ⚠️  This action is IRREVERSIBLE. The user's session will be invalidated
    after this call completes.
    """
    user_id = current_user.id

    # Ownership verification: users can only purge their own data
    verify_ownership(user_id, current_user)

    try:
        result = await purge_user_data_dsar(str(user_id), db)
        return {
            "success": True,
            "message": "Account data has been permanently deleted. Your session is now invalid.",
            "summary": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DSAR Purge] Unhandled error for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to purge user data")


@router.post("/profile/consent")
async def record_consent(
    body: ConsentRequest,
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    GDPR Article 7 / KVKK Article 5 — Consent Recording.

    Records the user's explicit consent (or withdrawal) with a server-side
    timestamp in the user_profiles table. This provides an auditable trail
    for regulatory compliance.

    Fire-and-forget: never raises 500 for non-critical DB failures.
    """
    user_id = current_user.id

    # Ownership verification
    verify_ownership(user_id, current_user)

    now_iso = datetime.now(timezone.utc).isoformat()
    user_id_str = str(user_id)

    try:
        from backend.utils.db import get_supabase_client

        admin_db = get_supabase_client(admin=True)
        writer_db = admin_db or db

        if not writer_db:
            logger.warning(f"[Consent] No DB available for user {user_id_str}, consent not persisted")
            return {
                "success": True,
                "message": "Consent acknowledged (persistence deferred)",
                "accepted": body.accepted,
                "recorded_at": now_iso,
            }

        if body.accepted:
            update_payload = {
                "consent_granted_at": now_iso,
                "updated_at": now_iso,
            }
        else:
            update_payload = {
                "consent_declined_at": now_iso,
                "updated_at": now_iso,
            }

        writer_db.table("user_profiles").update(update_payload).eq(
            "user_id", user_id_str
        ).execute()

        logger.info(
            f"[Consent] User {user_id_str} {'granted' if body.accepted else 'declined'} consent at {now_iso}"
        )

    except Exception as e:
        # Fire-and-forget: log but never raise 500 for consent recording
        logger.error(f"[Consent] Failed to persist consent for {user_id_str}: {e}")

    return {
        "success": True,
        "message": f"Consent {'granted' if body.accepted else 'declined'} successfully",
        "accepted": body.accepted,
        "recorded_at": now_iso,
    }
