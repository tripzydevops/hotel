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
    auth_plan = "trial"
    auth_status = "trial"
    sub_data = []
    current_period_end = None

    try:
        # We check the auth 'profiles' table for billing truth
        viewer_db = admin_db or db
        result = (
            viewer_db.table("profiles")
            .select("plan_type, subscription_status, current_period_end")
            .eq("id", user_id_str)
            .execute()
        )
        if result.data:
            sub_data = result.data
            auth_plan = sub_data[0].get("plan_type") or "trial"
            auth_status = sub_data[0].get("subscription_status") or "trial"
            current_period_end = sub_data[0].get("current_period_end")
    except Exception as e:
        print(f"Profile Sync Error: {e}")

    # 3. Administrative & Role-Based Access Logic (Bypasses)
    # We consolidate access rules here to ensure admins and enterprise users
    # are never locked out by stale auth table data.
    final_plan = auth_plan
    final_status = auth_status
    bypass_active = False
    is_verified_by_bypass = False

    # Extract metadata context for role checking
    meta_role = (base_data.get("role") or "user") if base_data else "user"
    meta_plan = (base_data.get("plan_type") or "trial") if base_data else "trial"

    def is_enterprise_val(p: Any) -> bool:
        return str(p).lower() == "enterprise"

    def is_admin_val(r: Any) -> bool:
        return str(r).lower() in ["admin", "market_admin", "market admin", "superadmin"]

    # ABILITY: Detect admin status via various channels
    is_admin_role = is_admin_val(meta_role)
    is_specific_admin = user_id_str == "eb284dd9-7198-47be-acd0-fdb0403bcd0a"

    # EMAIL CHECK (Requires Admin access)
    is_admin_email = False
    if admin_db:
        try:
            user_auth = admin_db.auth.admin.get_user_by_id(user_id_str)
            if user_auth and user_auth.user and user_auth.user.email:
                email_lower = user_auth.user.email.lower()
                is_admin_email = email_lower in [
                    "admin@hotel.plus",
                    "selcuk@rate-sentinel.com",
                    "asknsezen@gmail.com",
                    "askinsezen@gmail.com",
                    "yusuf@tripzy.travel",
                    "elif@tripzy.travel",
                    "tripzydevops@gmail.com", # Fix for the specific user reporting issues
                ] or email_lower.endswith("@hotel.plus")
        except Exception:
            pass

    # GLOBAL ACCESS RESOLUTION
    # Rule 1: Admins and Known DevOps/Support accounts are always Enterprise
    if is_admin_role or is_admin_email or is_specific_admin or is_dev_user:
        print(f"[Profile] Admin/Bypass detected for {user_id_str}. Granting Enterprise.")
        final_plan = "enterprise"
        final_status = "active"
        bypass_active = True
        is_verified_by_bypass = True
    
    # Rule 2: If either table explicitly says Enterprise, honor it (Most Permissive wins)
    # This prevents users from being stuck in "Trial" (limit 1) if they were manually upgraded
    elif is_enterprise_val(auth_plan) or is_enterprise_val(meta_plan):
        print(f"[Profile] Enterprise override detected (Auth: {auth_plan}, Meta: {meta_plan}) for {user_id_str}")
        final_plan = "enterprise"
        final_status = "active"
        bypass_active = True if is_enterprise_val(meta_plan) else False

    # Rule 3: General Fallback for trial discrepancies
    elif auth_plan == "trial" and meta_plan not in ["trial", None]:
        print(f"[Profile] Plan discrepancy: {auth_plan} vs {meta_plan}. Honoring metadata.")
        final_plan = meta_plan
        # Maintain status from billing truth unless it's a specific bypass branch above

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

    profile_result["plan_type"] = final_plan
    profile_result["subscription_status"] = final_status
    profile_result["is_admin_bypass"] = bypass_active

    # Map the current_period_end from the profiles table to the UserProfile fields
    # NOTE: current_period_end is extracted in section 2 of this function
    profile_result["trial_ends_at"] = current_period_end if final_status == "trial" else None
    profile_result["subscription_end_date"] = current_period_end if final_status != "trial" else None

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
    # BUGFIX: Use exclude_unset=True to only send fields the user explicitly provided,
    # preventing Pydantic defaults (e.g., theme_preference="light") from being sent
    # to the DB when the user never set them.
    update_data = {k: v for k, v in profile.model_dump(exclude_unset=True).items() if v is not None}
    user_id_str = str(user_id)

    # SAFETY: Whitelist of columns that exist in the user_profiles table.
    # This prevents PostgREST 400/500 errors if the Pydantic model has fields
    # that don't exist as DB columns yet.
    ALLOWED_COLUMNS = {
        "display_name", "company_name", "job_title", "phone", "avatar_url",
        "timezone", "theme_preference", "language_preference",
        "email", "role", "plan_type", "subscription_status", "is_verified",
        "trial_ends_at", "subscription_end_date",
    }
    update_data = {k: v for k, v in update_data.items() if k in ALLOWED_COLUMNS}

    if not update_data:
        # Nothing to update — just return current profile
        return await get_enriched_profile_logic(user_id, None, db)

    # Always stamp updated_at
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Upsert logic: Check existence first to avoid Supabase insert conflicts where possible
    existing = (
        db.table("user_profiles").select("user_id").eq("user_id", user_id_str).execute()
    )

    try:
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
    except Exception as db_err:
        print(f"[Profile] DB error during profile upsert for {user_id_str}: {db_err}")
        raise HTTPException(status_code=500, detail=f"Database update failed: {db_err}")

    if not result.data:
        print(f"[Profile] Empty result after upsert for {user_id_str}. RLS may be blocking the operation.")
        raise HTTPException(status_code=500, detail="Database update returned no data — check RLS policies")

    # After update, always re-enrich the data so the UI gets the correct plan status immediately
    return await get_enriched_profile_logic(user_id, result.data[0], db)
