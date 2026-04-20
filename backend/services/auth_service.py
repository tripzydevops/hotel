# Auth Protocol implementation (InsForge Compatibility)
# InsForge uses a direct REST API for session verification at /api/auth/sessions/current.
# This ensures compatibility with the remote infrastructure.

import os
import traceback
from types import SimpleNamespace

import httpx
from fastapi import Depends, HTTPException, Request

from backend.utils.db import get_supabase, get_supabase_client
from backend.utils.logger import get_logger
from supabase import Client

# Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

# InsForge backend URL for direct REST API calls
INSFORGE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")


async def _verify_token_via_insforge(token: str) -> dict:
    """
    Verify a JWT token by calling InsForge's REST API directly.

    Uses GET /api/auth/sessions/current instead of supabase-py's
    db.auth.get_user() which calls the incompatible /auth/v1/user path.

    Returns a SimpleNamespace with .id, .email, .role attributes (duck-typed
    to match what supabase-py's UserResponse.user would have provided).
    """
    url = f"{INSFORGE_URL}/api/auth/sessions/current"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Direct Session Verification via REST API.
    async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        token_preview = (
            f"{token[:6]}...{token[-4:]}" if len(token) > 20 else "short_token"
        )
        logger.error(
            f"InsForge auth verification failed: {resp.status_code} {resp.text[:200]} | Token: {token_preview} (len={len(token)})"
        )
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

    try:
        data = resp.json()
    except Exception:
        logger.error(f"InsForge auth returned non-JSON: {resp.text[:200]}")
        raise HTTPException(
            status_code=401, detail="Auth service returned invalid response"
        )

    # InsForge returns { "user": { "id": "...", "email": "...", "role": "..." } }
    user_data = data.get("user")
    if not user_data:
        logger.error(f"InsForge auth response missing 'user' key: {data}")
        raise HTTPException(status_code=401, detail="Invalid session payload")

    # Return a SimpleNamespace so existing code using getattr(user, "id") still works
    return SimpleNamespace(
        id=user_data.get("id"),
        email=user_data.get("email"),
        role=user_data.get("role", "authenticated"),
    )


def get_token(request: Request) -> str:
    """
    Extracts the Bearer token from the Authorization header or query parameter.
    Query parameter 'token' is used as a fallback for SSE (EventSource).
    """
    auth_header = request.headers.get("Authorization")
    if auth_header:
        token_parts = auth_header.split(" ")
        if len(token_parts) == 2 and token_parts[0].lower() == "bearer":
            return token_parts[1]

    # Fallback for SSE / Query Params
    query_token = request.query_params.get("token")
    if query_token:
        return query_token

    raise HTTPException(
        status_code=401, detail="Missing Authorization Header or Token Query Param"
    )


async def get_current_admin_user(
    request: Request,
    token: str = Depends(get_token),
    db: Client = Depends(get_supabase),
):
    """
    Verify that the request is made by an Admin.
    """
    try:
        # Verify token via InsForge REST API (not supabase-py)
        user_obj = await _verify_token_via_insforge(token)

        user_id = getattr(user_obj, "id", None)
        email = getattr(user_obj, "email", None)

        # Verify admin role in database
        try:
            profile_res = (
                db.table("user_profiles")
                .select("role")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if profile_res.data and profile_res.data[0].get("role") in [
                "admin",
                "market_admin",
                "market admin",
            ]:
                return user_obj
        except Exception as db_e:
            logger.error(f"Admin RBAC Error for {email}: {db_e}")

        raise HTTPException(status_code=403, detail="Admin Access Required")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=str(e))


async def get_current_active_user(
    request: Request,
    token: str = Depends(get_token),
    db: Client = Depends(get_supabase),
):
    """
    Verify that the user is logged in AND has an active approval status.
    """
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database Unavailable")

        # Verify token via InsForge REST API (not supabase-py)
        user = await _verify_token_via_insforge(token)

        user_id = getattr(user, "id", None)
        email = getattr(user, "email", "No Email")

        # --- GHOST MODE (IMPERSONATION) LOGIC ---
        # Allow admins to masquerade as other users using the x-impersonate-user-id header.
        # This is critical for support/debugging without requiring user credentials.
        impersonate_id = request.headers.get("x-impersonate-user-id")
        original_admin_id = None

        if impersonate_id and impersonate_id != str(user_id):
            # 1. Verify that the REAL user (from JWT) is an admin
            # We check the 'user_profiles' table for role parity.
            admin_check = (
                db.table("user_profiles")
                .select("role")
                .eq("user_id", str(user_id))
                .maybe_single()
                .execute()
            )
            is_real_admin = admin_check.data and admin_check.data.get(
                "role", ""
            ).lower() in ["admin", "market_admin", "market admin"]

            if is_real_admin:
                logger.info(
                    f"ADMIN {email} ({user_id}) initiating IMPERSONATION of {impersonate_id}"
                )

                # Fetch target user profile to "become" them
                target_res = (
                    db.table("user_profiles")
                    .select("user_id, email, display_name")
                    .eq("user_id", str(impersonate_id))
                    .maybe_single()
                    .execute()
                )

                if target_res.data:
                    # Capture original ID for audit
                    original_admin_id = user_id

                    # SWAP IDENTITY
                    # We update the 'user' namespace object to masquerade as the target.
                    # This ensures downstream logic (settings, scan filtering) uses the target's ID.
                    user.id = target_res.data["user_id"]
                    user.email = target_res.data.get("email")
                    user.is_impersonating = True
                    user.real_user_id = original_admin_id

                    # Update local variables for the rest of this function's checks
                    user_id = user.id
                    email = user.email
                    logger.info(f"Identity SWAPPED: Now acting as {email} ({user_id})")
                else:
                    logger.warning(
                        f"Impersonation failed: Target user {impersonate_id} not found."
                    )
            else:
                logger.warning(
                    f"Security Alert: Non-admin {email} attempted impersonation of {impersonate_id}"
                )
                # We don't raise 401 here to prevent info leakage, just ignore the header.

        # --- END GHOST MODE logic ---

        # User Verification Logic (Fail-Open)
        # We perform a multi-table check:
        # 1. 'profiles' (legacy) for roles.
        # 2. 'user_profiles' (modern) for subscription and verification status.
        # Check Account Status
        status = "active"
        is_verified = True  # Default to True if InsForge session is valid
        user_role = "authenticated"

        email = getattr(user, "email", "No Email")
        logger.info(f"Checking verification for {user_id} ({email})")

        # Diagnostic: Log SUPABASE connection details
        try:
            active_url = (
                str(db.supabase_url) if hasattr(db, "supabase_url") else "Unknown"
            )
            logger.info(f"Supabase Client Target URL: {active_url}")
        except Exception:
            pass

        try:
            # Check 'profiles' table first (legacy consistency)
            res = (
                db.table("profiles")
                .select("role")
                .eq("id", str(user_id))
                .maybe_single()
                .execute()
            )
            logger.info(f"DB PROFILE CHECK for {user_id}: {res.data}")
            if res.data:
                user_role = res.data.get("role", "authenticated")
                logger.info(f"Found legacy profile role: {user_role}")

            # Now check 'user_profiles' for more accurate/recent data including 'is_verified'
            res2 = (
                db.table("user_profiles")
                .select("subscription_status, is_verified, role")
                .eq("user_id", str(user_id))
                .maybe_single()
                .execute()
            )

            if res2.data:
                # user_profiles takes precedence for these security fields
                status = res2.data.get("subscription_status") or status

                # IMPORTANT: If is_verified is EXPLICITLY False in DB, we block them.
                # If it's missing or True, they pass (Fail-Open relative to DB query success).
                is_verified_val = res2.data.get("is_verified")
                if is_verified_val is False:
                    is_verified = False
                    logger.warning(
                        f"User {user_id} explicitly not verified in database."
                    )

                user_role = res2.data.get("role") or user_role
                logger.info(
                    f"Found user_profile: role={user_role}, status={status}, is_verified_val={is_verified_val}"
                )
            else:
                # Ensure a row exists in user_profiles to prevent downstream data orphans.
                logger.info(
                    f"No user_profile found for {user_id}, triggering initialization..."
                )
                try:
                    from backend.services.profile_service import (
                        get_enriched_profile_logic,
                    )

                    healed_profile = await get_enriched_profile_logic(user_id, None, db)
                    if healed_profile:
                        status = healed_profile.get("subscription_status") or status
                        is_verified_val = healed_profile.get("is_verified")
                        if is_verified_val is False:
                            is_verified = False
                        user_role = healed_profile.get("role") or user_role
                        logger.info(
                            f"Self-healed profile for {user_id}: role={user_role}, status={status}"
                        )
                except Exception as heal_e:
                    logger.error(f"Self-healing failed for {user_id}: {heal_e}")
                    # Non-fatal: user can still proceed with session defaults

        except Exception as status_e:
            logger.error(f"Verification check error for {user_id}: {status_e}")
            logger.error(traceback.format_exc())

        # Enforce Admin Verification
        is_admin = str(user_role).lower() in ["admin", "market_admin", "market admin"]
        logger.info(
            f"AUTH GATE RESULT: is_verified={is_verified}, is_admin={is_admin}, role={user_role}"
        )

        if not is_verified and not is_admin:
            logger.warning(
                f"Blocked unverified user {getattr(user, 'email', 'Unknown')} ({user_id})"
            )
            raise HTTPException(
                status_code=403,
                detail="Account pending administrator approval. Please contact support.",
            )

        if status in ["suspended", "rejected"]:
            raise HTTPException(status_code=403, detail="Account Suspended/Rejected")

        return user

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.critical(f"Auth Critical: {traceback.format_exc()}")
        raise HTTPException(status_code=401, detail=f"Authentication Failed: {str(e)}")


def get_supabase_rls(
    token: str = Depends(get_token),
) -> Client:
    """
    Dependency that returns a Supabase client with RLS enabled.
    Uses the JWT from the Authorization header.
    """
    return get_supabase_client(jwt=token)


def get_supabase_admin() -> Client:
    """
    Dependency that returns a Supabase client with Admin privileges (Service Role).
    Used for performance-sensitive background operations that bypass RLS.
    """
    return get_supabase_client(admin=True)
