"""
Admin — User Management
========================
Handles user CRUD, search, and profile enrichment for the admin panel.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
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
    Supports optional search query 'q'.
    """
    try:
        # 1. Fetch profiles based on search query
        query = db.table("user_profiles").select("*")
        if q:
            # Multi-field search using OR logic
            # Note: ilike is used for PostgreSQL case-insensitive search
            query = query.or_(
                f"email.ilike.%{q}%,display_name.ilike.%{q}%,company_name.ilike.%{q}%"
            )

        profiles_res = query.execute()
        profiles_data = profiles_res.data or []

        sub_res = (
            db.table("profiles").select("id, plan_type, subscription_status").execute()
        )
        sub_map = {s["id"]: s for s in (sub_res.data or [])}

        users_map = {}
        for p in profiles_data:
            uid = str(p["user_id"])
            if uid not in users_map:
                users_map[uid] = {
                    "id": uid,
                    "email": p.get("email") or "Unknown",
                    "display_name": p.get("display_name"),
                    "company_name": p.get("company_name"),
                    "job_title": p.get("job_title"),
                    "phone": p.get("phone"),
                    "timezone": p.get("timezone"),
                    "is_verified": p.get("is_verified", False),
                    "created_at": p.get("created_at") or datetime.now().isoformat(),
                }

            sub_data = sub_map.get(uid, {})
            users_map[uid]["plan_type"] = (
                sub_data.get("plan_type") or p.get("plan_type") or "trial"
            )
            users_map[uid]["subscription_status"] = (
                sub_data.get("subscription_status")
                or p.get("subscription_status")
                or "trial"
            )

        final_users = []
        for uid, udata in users_map.items():
            try:
                # Optimized count: Hotels this user is MAPPED to
                h_count = (
                    db.table("user_hotels")
                    .select("id", count="exact")
                    .eq("user_id", uid)
                    .execute()
                    .count
                    or 0
                )
                s_count = (
                    db.table("scan_sessions")
                    .select("id", count="exact")
                    .eq("user_id", uid)
                    .execute()
                    .count
                    or 0
                )
                udata["hotel_count"] = h_count
                udata["scan_count"] = s_count

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
            db.table("user_profiles").update(profile_fields).eq(
                "user_id", user_id_str
            ).execute()
            if "plan_type" in profile_fields or "subscription_status" in profile_fields:
                sub_update = {
                    k: v
                    for k, v in profile_fields.items()
                    if k in ["plan_type", "subscription_status"]
                }
                db.table("profiles").update(sub_update).eq("id", user_id_str).execute()

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
