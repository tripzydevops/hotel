"""
Authentication and Authorization Service.
Handles role-based access control (RBAC) and user session verification.

ARCHITECTURE NOTE (2026-03-29):
InsForge is NOT compatible with supabase-py's auth.get_user() which calls
/auth/v1/user (GoTrue path). InsForge returns a 0-byte body at that path.
Instead, we call InsForge's REST API directly: GET /api/auth/sessions/current
"""

import os
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

# InsForge backend URL for direct REST API calls
INSFORGE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://pa5riyqv.eu-central.insforge.app")


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
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
    
    if resp.status_code != 200:
        logger.error(f"InsForge auth verification failed: {resp.status_code} {resp.text[:200]}")
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    
    try:
        data = resp.json()
    except Exception:
        logger.error(f"InsForge auth returned non-JSON: {resp.text[:200]}")
        raise HTTPException(status_code=401, detail="Auth service returned invalid response")
    
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

    raise HTTPException(status_code=401, detail="Missing Authorization Header or Token Query Param")


async def get_current_admin_user(request: Request, token: str = Depends(get_token), db: Client = Depends(get_supabase)):
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
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=401, detail=str(e))


async def get_current_active_user(request: Request, token: str = Depends(get_token), db: Client = Depends(get_supabase)):
    """
    Verify that the user is logged in AND has an active approval status.
    """
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database Unavailable")

        # Verify token via InsForge REST API (not supabase-py)
        user = await _verify_token_via_insforge(token)

        user_id = getattr(user, "id", None)

        # Check Account Status
        status = "pending_approval"
        is_verified = False # Default to False: All users must be verified by admin
        user_role = "authenticated"

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
            
            # Now check 'user_profiles' for more accurate/recent data including 'is_verified'
            res2 = (
                db.table("user_profiles")
                .select("subscription_status, is_verified, role")
                .eq("user_id", str(user_id))
                .maybe_single()
                .execute()
            )
            logger.info(f"DB USER_PROFILE CHECK for {user_id}: {res2.data}")
            if res2.data:
                # user_profiles takes precedence for these security fields
                status = res2.data.get("subscription_status") or status
                is_verified = res2.data.get("is_verified", False)
                user_role = res2.data.get("role") or user_role

        except Exception as status_e:
            logger.warning(f"Could not verify status for {user_id}: {status_e}")

        # [POLICY] Enforce Admin Verification
        is_admin = str(user_role).lower() in ["admin", "market_admin", "market admin"]
        logger.info(f"AUTH GATE RESULT: is_verified={is_verified}, is_admin={is_admin}, role={user_role}")
        
        if not is_verified and not is_admin:
            logger.warning(f"Blocked unverified user {getattr(user, 'email', 'Unknown')} ({user_id})")
            raise HTTPException(
                status_code=403, 
                detail="Account pending administrator approval. Please contact support."
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
