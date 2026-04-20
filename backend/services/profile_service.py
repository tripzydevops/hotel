"""
Profile Service
Handles business logic for user profiles, including plan enrichment and admin bypasses.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import HTTPException

from backend.models.schemas import UserProfileUpdate
from supabase import Client


async def get_enriched_profile_logic(
    user_id: UUID, base_data: Optional[Dict[str, Any]], db: Client
) -> Dict[str, Any]:
    # EXPLANATION: Profile Enrichment & Data Governance
    # We separate 'user_profiles' (managed metadata) from 'profiles' (auth system truth)
    # to handle complex enterprise/admin overrides without polluting the primary
    # authentication tables. This ensures admin bypasses and specific plan overrides
    # work even if the central billing system is slow to update.
    user_id_str = str(user_id)
    is_dev_user = user_id_str == "123e4567-e89b-12d3-a456-426614174000"

    # 0. Prepare admin access for truth checking and self-healing
    from backend.utils.db import get_supabase_client

    admin_db = get_supabase_client(admin=True)
    if not admin_db:
        print("[Profile] Admin access unavailable, proceeding with basic DB connection")

    # 1. Fetch base metadata if not provided
    if base_data is None:
        try:
            res = (
                db.table("user_profiles")
                .select("*")
                .eq("user_id", user_id_str)
                .execute()
            )
            if res.data:
                base_data = res.data[0]
            else:
                # EXPLANATION: Automatic Profile Provisioning (Self-Healing)
                # If the user is authenticated but missing a record in user_profiles,
                # we create a fallback record from Auth metadata. This prevents
                # users from being 'invisible' in the admin dashboard and protects
                # them from "account cleanup" scripts that look for orphaned hotels.
                if admin_db:
                    try:
                        auth_user = admin_db.auth.admin.get_user_by_id(user_id_str)
                        if auth_user and auth_user.user:
                            email = auth_user.user.email
                            new_profile = {
                                "user_id": user_id_str,
                                "email": email,
                                "display_name": email.split("@")[0]
                                if email
                                else "User",
                                "role": "user",
                                "plan_type": "trial",
                                "subscription_status": "trial",
                                "is_verified": False,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            }
                            admin_db.table("user_profiles").insert(
                                new_profile
                            ).execute()
                            base_data = new_profile
                            print(
                                f"[Profile] Self-healed missing profile for {user_id_str}"
                            )

                            # Initialize default settings
                            admin_db.table("settings").upsert(
                                {
                                    "user_id": user_id_str,
                                    "threshold_percent": 1.0,
                                    "notifications_enabled": True,
                                    "currency": "TRY",
                                    "created_at": datetime.now(
                                        timezone.utc
                                    ).isoformat(),
                                    "updated_at": datetime.now(
                                        timezone.utc
                                    ).isoformat(),
                                }
                            ).execute()
                    except Exception as he:
                        print(f"[Profile] Self-healing attempt failed: {he}")
        except Exception as e:
            print(f"Base Profile Fetch Error: {e}")

    # 2. Fetch subscription info (truth source) from the auth profiles table

    plan = "trial"
    status = "trial"
    bypass_active = False
    is_verified_by_bypass = False
    sub_data = []

    try:
        viewer_db = db
        viewer_db = admin_db or db

        result = (
            viewer_db.table("profiles")
            .select("plan_type, subscription_status")
            .eq("id", user_id_str)
            .execute()
        )
        sub_data = result.data
    except Exception as e:
        print(f"Profile Sync Error: {e}")

    if sub_data:
        plan = sub_data[0].get("plan_type") or "trial"
        status = sub_data[0].get("subscription_status") or "trial"

    # EXPLANATION: Administrative Bypass (Super-User Rules)
    # This logic forces "Enterprise" status for known admin IDs and internal
    # emails. This ensures internal staff always have full platform access
    # regardless of their billing status. This is a critical debugging/testing bridge.
    try:
        specific_admin_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
        is_specific_admin = user_id_str == specific_admin_id

        if admin_db:
            admin_email_found = None
            try:
                user_auth = admin_db.auth.admin.get_user_by_id(user_id_str)
                if user_auth and user_auth.user:
                    admin_email_found = user_auth.user.email
            except Exception:
                pass

            is_admin_email = False
            if admin_email_found:
                email_lower = admin_email_found.lower()
                is_admin_email = email_lower in [
                    "admin@hotel.plus",
                    "selcuk@rate-sentinel.com",
                    "asknsezen@gmail.com",
                    "askinsezen@gmail.com",
                    "yusuf@tripzy.travel",
                    "elif@tripzy.travel",
                ] or email_lower.endswith("@hotel.plus")

            is_admin_role = (
                base_data
                and base_data.get("role")
                and str(base_data.get("role")).lower()
                in ["admin", "market_admin", "market admin"]
            )

            if is_admin_email or is_admin_role or is_specific_admin:
                plan = "enterprise"
                status = "active"
                bypass_active = True
                is_verified_by_bypass = True

        elif is_specific_admin:
            plan = "enterprise"
            status = "active"
            bypass_active = True
    except Exception as e:
        print(f"[Profile] Bypass Logic Error: {e}")

    # 3. Fallback to base_data if subscription lookup failed or returned trial
    if (not sub_data or plan == "trial") and base_data:
        if not bypass_active:
            plan = base_data.get("plan_type") or plan
            status = base_data.get("subscription_status") or status

    # 4. Force Enterprise for Development/Testing User
    if is_dev_user:
        plan = "enterprise"
        status = "active"
        bypass_active = True
        is_verified_by_bypass = True

    # Final Merge: Take base profile metadata and inject calculated plan status
    profile_result: Dict[str, Any] = {}
    if base_data:
        profile_result.update(base_data)
    else:
        profile_result["user_id"] = user_id_str

    # ENSURE AT LEAST ONE NAME FIELD IS POPULATED
    if not profile_result.get("display_name"):
        email = profile_result.get("email")
        if not email and admin_db:
            try:
                auth_user = admin_db.auth.admin.get_user_by_id(user_id_str)
                if auth_user and auth_user.user:
                    email = auth_user.user.email
            except Exception:
                pass

        profile_result["display_name"] = (
            email.split("@")[0].capitalize() if email else "User"
        )

    profile_result["plan_type"] = plan
    profile_result["subscription_status"] = status
    profile_result["is_admin_bypass"] = bypass_active

    profile_result["timezone"] = profile_result.get("timezone") or "UTC"

    # Finalize is_verified if not already set by bypass
    if is_verified_by_bypass:
        profile_result["is_verified"] = True
    elif "is_verified" not in profile_result:
        profile_result["is_verified"] = (
            base_data.get("is_verified", False) if base_data else False
        )

    # Ensure timestamps exist for model validation
    # BUGFIX: Check for None values too, not just missing keys.
    # Some user_profiles rows have NULL created_at/updated_at in the database,
    # which causes Pydantic validation to fail with a 500 since UserProfile
    # requires non-optional datetime fields.
    now_iso = datetime.now(timezone.utc).isoformat()
    if not profile_result.get("created_at"):
        profile_result["created_at"] = now_iso
    if not profile_result.get("updated_at"):
        profile_result["updated_at"] = now_iso

    # KAIZEN: Convert datetime objects to ISO strings for Pydantic consistency
    for key in ["created_at", "updated_at"]:
        if isinstance(profile_result.get(key), datetime):
            profile_result[key] = profile_result[key].isoformat()

    return profile_result


async def update_profile_logic(
    user_id: UUID, profile: UserProfileUpdate, db: Client
) -> Dict[str, Any]:
    """
    Handles the 'upsert' logic for user profiles.

    Why: Not all users have a 'user_profiles' entry immediately on signup.
    This logic ensures a record is created or updated seamlessly.
    """
    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    user_id_str = str(user_id)

    # Upsert logic: Check existence first to avoid Supabase insert conflicts where possible
    existing = (
        db.table("user_profiles").select("user_id").eq("user_id", user_id_str).execute()
    )

    if not existing.data:
        result = (
            db.table("user_profiles")
            .insert({"user_id": user_id_str, **update_data})
            .execute()
        )
    else:
        result = (
            db.table("user_profiles")
            .update(update_data)
            .eq("user_id", user_id_str)
            .execute()
        )

    if not result.data:
        raise HTTPException(status_code=500, detail="Database update failed")

    # After update, always re-enrich the data so the UI gets the correct plan status immediately
    return await get_enriched_profile_logic(user_id, result.data[0], db)
