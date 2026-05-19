"""
Admin — User Management
========================
Handles user CRUD, search, and profile enrichment for the admin panel.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, cast
from uuid import UUID

from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.models.schemas import (
    AdminUser,
    AdminUserCreate,
    AdminUserUpdate,
)
from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_admin_users_logic(db: Client, q: Optional[str] = None) -> List[AdminUser]:
    """
    Fetch all users with enriched metadata (hotel/scan counts, plans).
    Sources from auth.users via RPC, enriches with profiles table.
    Supports optional search query 'q'.
    """
    try:
        # 1. Fetch ALL auth users via RPC (primary source of truth)
        # Uses SECURITY DEFINER function that reads auth.users directly,
        # excluding system/seed accounts (admin@example.com, anon@example.com)
        auth_res = db.rpc("get_auth_users").execute()
        auth_users = cast(List[Dict[str, Any]], auth_res.data or [])

        # 2. Fetch profiles for enrichment
        profiles_res = db.table("profiles").select("*").execute()
        profiles_map: Dict[str, Dict[str, Any]] = {}
        for p in cast(List[Dict[str, Any]], profiles_res.data or []):
            profiles_map[str(p["id"])] = p

        # 3. Build unified users map from auth users
        users_map: Dict[str, Dict[str, Any]] = {}
        for au in auth_users:
            uid = str(au["id"])
            email = au.get("email", "")
            profile = profiles_map.get(uid, {})
            user_meta = au.get("metadata") or {}

            # Apply search filter if query provided
            if q:
                q_lower = q.lower()
                searchable = f"{email} {profile.get('display_name', '')} {profile.get('company_name', '')}".lower()
                if q_lower not in searchable:
                    continue

            # Merge auth data with profile data
            users_map[uid] = {
                "id": uid,
                "email": email or profile.get("email") or "Unknown",
                "display_name": profile.get("display_name") or user_meta.get("display_name") or user_meta.get("full_name"),
                "company_name": profile.get("company_name"),
                "job_title": profile.get("job_title"),
                "phone": profile.get("phone") or user_meta.get("phone"),
                "timezone": profile.get("timezone"),
                "is_verified": profile.get("is_verified", au.get("email_verified", False)),
                "created_at": au.get("created_at") or profile.get("created_at") or datetime.now().isoformat(),
                "plan_type": profile.get("plan_type") or "trial",
                "subscription_status": profile.get("subscription_status") or "trial",
            }

        # Collect all user IDs
        user_ids = list(users_map.keys())

        # Pre-initialize counting maps
        hotel_counts = {uid: 0 for uid in user_ids}
        scan_counts = {uid: 0 for uid in user_ids}

        if user_ids:
            try:
                # Bulk fetch user_hotels mapped to these user_ids
                hotels_res = (
                    db.table("user_hotels")
                    .select("id, user_id")
                    .in_("user_id", user_ids)
                    .execute()
                )
                for h in (hotels_res.data or []):
                    h_uid = str(h.get("user_id"))
                    if h_uid in hotel_counts:
                        hotel_counts[h_uid] += 1
            except PostgRESTError as e:
                logger.warning(f"Failed to bulk fetch user_hotels count: {e}")

            try:
                # Bulk fetch scan_sessions mapped to these user_ids
                scans_res = (
                    db.table("scan_sessions")
                    .select("id, user_id")
                    .in_("user_id", user_ids)
                    .execute()
                )
                for s in (scans_res.data or []):
                    s_uid = str(s.get("user_id"))
                    if s_uid in scan_counts:
                        scan_counts[s_uid] += 1
            except PostgRESTError as e:
                logger.warning(f"Failed to bulk fetch scan_sessions count: {e}")

        final_users = []
        for uid, udata in users_map.items():
            try:
                udata["hotel_count"] = hotel_counts.get(uid, 0)
                udata["scan_count"] = scan_counts.get(uid, 0)

                # EXPLANATION: Plan-Based Quota Logic
                from backend.services.subscription import SubscriptionService

                access = await SubscriptionService.get_user_limits(db, udata)
                udata["max_hotels"] = access.get("limits", {}).get("hotel_limit", 5)

                final_users.append(AdminUser(**udata))
            except (KeyError, TypeError) as e:
                logger.warning(f"Data enrichment error for user {uid}: {e}")
                udata["max_hotels"] = 5  # Absolute fallback
                final_users.append(AdminUser(**udata))
            except PostgRESTError as e:
                logger.warning(f"DB query failed during enrichment for user {uid}: {e}")
                udata["hotel_count"] = 0
                udata["scan_count"] = 0
                udata["max_hotels"] = 5
                final_users.append(AdminUser(**udata))

        return final_users
    except PostgRESTError as e:
        logger.error(f"PostgREST error fetching admin users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error fetching users")
    except (KeyError, TypeError) as e:
        logger.error(f"Data mapping error in admin users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process user data")


async def admin_update_user_logic(
    user_id: UUID, updates: AdminUserUpdate, db: Client
) -> Dict[str, Any]:
    """Admin: Update user details including schedule and settings."""
    try:
        user_id_str = str(user_id)
        # 1. Update Profile Fields
        profile_fields = {}
        if updates.display_name is not None:
            profile_fields["display_name"] = updates.display_name
        if updates.company_name is not None:
            profile_fields["company_name"] = updates.company_name
        if updates.job_title is not None:
            profile_fields["job_title"] = updates.job_title
        if updates.phone is not None:
            profile_fields["phone"] = updates.phone
        if updates.timezone is not None:
            profile_fields["timezone"] = updates.timezone
        if updates.plan_type is not None:
            profile_fields["plan_type"] = updates.plan_type
        if updates.subscription_status is not None:
            profile_fields["subscription_status"] = updates.subscription_status
        if updates.is_verified is not None:
            profile_fields["is_verified"] = updates.is_verified

        if profile_fields:
            db.table("profiles").update(profile_fields).eq(
                "id", user_id_str
            ).execute()

        # 2. Update Settings Fields

        # 3. Update Auth Fields (Requires Admin Bypass)
        from backend.utils.db import get_supabase_client

        admin_db = get_supabase_client(admin=True)
        if admin_db:
            try:
                auth_updates = {}
                if updates.email:
                    auth_updates["email"] = updates.email
                if updates.password:
                    auth_updates["password"] = updates.password
                if auth_updates:
                    # KAİZEN: Handle cases where user might not exist in Auth but exists in profiles
                    admin_db.auth.admin.update_user_by_id(user_id_str, auth_updates)
            except PostgRESTError as auth_err:
                logger.warning(
                    f"Auth DB update failed for {user_id_str}: {auth_err}"
                )
            except (ValueError, AttributeError) as auth_err:
                logger.warning(
                    f"Auth-side update skipped for {user_id_str}: {auth_err}"
                )
                # We don't raise here because profile/settings might have succeeded

        return {"status": "success", "message": "User updated successfully"}
    except HTTPException:
        raise
    except PostgRESTError as e:
        logger.error(f"PostgREST error updating user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error updating user")
    except (KeyError, TypeError, ValueError) as e:
        logger.error(f"Data error updating user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


async def create_admin_user_logic(user: AdminUserCreate, db: Client) -> Dict[str, Any]:
    """
    Manually create a user in Supabase Auth and User Profiles.
    Requires SERVICE_ROLE_KEY.
    """
    from backend.utils.db import get_supabase_client

    admin_db = get_supabase_client(admin=True)
    if not admin_db:
        raise HTTPException(
            status_code=500, detail="Admin credentials missing or unreachable"
        )
    try:
        res = admin_db.auth.admin.create_user(
            {"email": user.email, "password": user.password, "email_confirm": True}
        )
        new_user = res.user
        if not new_user:
            raise HTTPException(
                status_code=400, detail="Supabase Auth rejected creation"
            )

        # 2. Add Profile
        admin_db.table("user_profiles").insert(
            {
                "user_id": str(new_user.id),
                "display_name": user.display_name or user.email.split("@")[0],
                "email": user.email,
                "plan_type": user.plan_type,
                "subscription_status": user.subscription_status,
                "is_verified": user.is_verified
                if user.is_verified is not None
                else True,
            }
        ).execute()

        # 3. Add to Profiles (for subscription lookup)
        now = datetime.now(timezone.utc)
        trial_end = (now + timedelta(days=15)).isoformat().replace("+00:00", "Z")
        admin_db.table("profiles").insert(
            {
                "id": str(new_user.id),
                "plan_type": user.plan_type,
                "subscription_status": user.subscription_status,
                "current_period_end": trial_end
                if user.subscription_status == "trial"
                else None,
            }
        ).execute()

        # 4. Add default Settings
        admin_db.table("settings").insert(
            {
                "user_id": str(new_user.id),
                "threshold_percent": 2.0,
                "notifications_enabled": True,
                "push_enabled": False,
                "currency": "TRY",
                "dynamic_threshold_enabled": False,
                "dynamic_threshold_sensitivity": 1.0,
            }
        ).execute()

        return {"status": "success", "user_id": str(new_user.id)}
    except HTTPException:
        raise
    except PostgRESTError as e:
        logger.error(f"PostgREST error creating user {user.email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except (AttributeError, KeyError) as e:
        logger.error(f"Auth/data error creating user {user.email}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


async def delete_admin_user_logic(user_id: str, db: Client) -> Dict[str, Any]:
    """
    Delete a user and cascade delete their data.
    """
    from backend.utils.db import get_supabase_client

    admin_db = get_supabase_client(admin=True)
    if not admin_db:
        raise HTTPException(
            status_code=500, detail="Admin credentials missing or unreachable"
        )
    tables = [
        "hotels",
        "scan_sessions",
        "user_profiles",
        "settings",
        "notifications",
        "reports",
    ]
    for table in tables:
        try:
            admin_db.table(table).delete().eq("user_id", str(user_id)).execute()
        except PostgRESTError as e:
            logger.warning(f"Cascade delete failed for {table}/{user_id}: {e}")

    try:
        admin_db.auth.admin.delete_user(str(user_id))
    except (PostgRESTError, AttributeError, ValueError) as e:
        logger.warning(f"Auth user deletion failed for {user_id}: {e}")

    return {"status": "success"}
