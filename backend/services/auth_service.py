"""
Authentication and Authorization Service.
Handles role-based access control (RBAC) and user session verification.
"""

import traceback
from fastapi import Depends, HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.utils.db import get_supabase_client, get_supabase
from supabase import Client


from backend.utils.logger import get_logger
import httpx
from types import SimpleNamespace

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)


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

    raise HTTPException(status_code=401, detail="Missing Authorization Header or Token Query Param")


async def get_current_admin_user(token: str = Depends(get_token), db: Client = Depends(get_supabase)):
    """
    Verify that the request is made by an Admin.
    Checks Authorization header (JWT) via Supabase Auth.
    Then verifies 'role' in 'user_profiles' or checks whitelist.

    Reminder Note: Admin access is strictly enforced for system-level changes
    and multi-tenant visibility.
    """
    try:
        # Call InsForge to verify token
        try:
            auth_url = f"{str(db.auth._url).rstrip('/')}/sessions/current"
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": str(db.supabase_key)
            }
            
            with httpx.Client() as client:
                response = client.get(auth_url, headers=headers)
                
            if response.status_code == 200:
                user_data = response.json().get("user")
                if not user_data:
                    raise HTTPException(status_code=401, detail="Invalid Admin Session Payload")
                
                # Mock a user object structure similar to Supabase User for compatibility
                user_obj = SimpleNamespace(
                    id=user_data.get("id"),
                    email=user_data.get("email"),
                    role=user_data.get("role", "authenticated"),
                    app_metadata=user_data.get("app_metadata", {}),
                    user_metadata=user_data.get("user_metadata", {})
                )
            else:
                logger.error(f"InsForge Admin Auth Failed ({response.status_code}): {response.text[:200]}")
                # Fallback
                user_resp = db.auth.get_user(token)
                if not user_resp or not user_resp.user:
                    raise HTTPException(status_code=401, detail="InsForge: Invalid Token")
                user_obj = user_resp.user
        except Exception as auth_e:
            raise HTTPException(
                status_code=401, detail=f"InsForge Auth Error: {str(auth_e)}"
            )

        user_id = user_obj.id
        email = user_obj.email

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
            pass

        logger.warning(
            f"Access Denied: User {email} attempted admin access without sufficient role."
        )
        raise HTTPException(status_code=403, detail="Admin Access Required")

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.critical(f"Admin Auth CRITICAL: {e}")
        raise HTTPException(status_code=401, detail=f"Auth Critical Failure: {str(e)}")


async def get_current_active_user(token: str = Depends(get_token), db: Client = Depends(get_supabase)):
    """
    Verify that the user is logged in AND has an active approval status.
    Blocks access if account is 'suspended' or 'rejected'.

    Reminder Note: Even valid JWT holders can be blocked if their subscription
    is not active (Autonomous Cloud Governance).
    """
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database Unavailable")

        try:
            # IDENTITY VERIFICATION (STABLE Baseline: af7e411)
            # We call /sessions/current specifically because this origin
            # does NOT support the generic /user endpoint (returning 404).
            auth_url = f"{str(db.auth._url).rstrip('/')}/sessions/current"
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": str(db.supabase_key)
            }
            
            with httpx.Client() as client:
                response = client.get(auth_url, headers=headers)
                
            if response.status_code == 200:
                user_data = response.json().get("user")
                if not user_data:
                    raise HTTPException(status_code=401, detail="Invalid Session Payload")
                
                # IDENTITY MAPPING (STABLE Baseline: af7e411)
                # We mock a Supabase-compatible User object so downstream services
                # can access .id, .email, and .app_metadata without crashing.
                user = SimpleNamespace(
                    id=user_data.get("id"),
                    email=user_data.get("email"),
                    role=user_data.get("role", "authenticated"),
                    app_metadata=user_data.get("app_metadata", {}),
                    user_metadata=user_data.get("user_metadata", {}),
                    aud="authenticated",
                    created_at=user_data.get("created_at")
                )
            else:
                logger.error(f"InsForge Auth Failed ({response.status_code}): {response.text[:200]}")
                raise HTTPException(status_code=401, detail=f"Authentication Failed: Invalid or expired session")
                
        except Exception as auth_e:
            logger.error(f"Auth Token Verification Failed: {auth_e}")
            raise HTTPException(status_code=401, detail=f"Token verification failed: {str(auth_e)}")

        user_id = user.id

        # Check Account Status
        status = "pending_approval"
        try:
            # Check 'profiles' table first (legacy consistency)
            res = (
                db.table("profiles")
                .select("subscription_status")
                .eq("id", str(user_id))
                .maybe_single()
                .execute()
            )
            if res.data:
                status = res.data.get("subscription_status")
            else:
                # Fallback to 'user_profiles'
                res2 = (
                    db.table("user_profiles")
                    .select("subscription_status")
                    .eq("user_id", str(user_id))
                    .maybe_single()
                    .execute()
                )
                if res2.data:
                    status = res2.data.get("subscription_status")
        except Exception as status_e:
            # If DB check fails, we default to pending/safe state but DON'T crash 500
            logger.warning(f"Could not verify status for {user_id}: {status_e}")

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


async def get_async_supabase_rls(
    token: str = Depends(get_token),
) -> Client:
    """
    Async dependency that returns a Supabase AsyncClient with RLS enabled.
    """
    from backend.utils.db import get_async_supabase_client
    return await get_async_supabase_client(jwt=token)
