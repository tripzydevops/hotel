from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Any
from backend.services.auth_service import get_current_active_user
from backend.utils.db import get_supabase
from supabase import Client
from backend.utils.logger import get_logger
from backend.utils.limiter import limiter

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/user", include_in_schema=True)
@limiter.limit("10/minute")
async def get_user_info(request: Request, db: Client = Depends(get_supabase)):
    """Returns current user info."""
    from backend.services.auth_service import get_token, get_current_active_user
    try:
        token = get_token(request)
        user = await get_current_active_user(request, token, db)
        return {"user": user}
    except Exception as e:
        logger.error(f"Error in /api/auth/user: {e}")
        raise HTTPException(status_code=401, detail=str(e))

@router.api_route("", methods=["GET", "POST", "HEAD"])
@router.api_route("/", methods=["GET", "POST", "HEAD"])
@limiter.limit("10/minute")
async def auth_root_sync(request: Request, db: Client = Depends(get_supabase)):
    """Unified endpoint for base /api/auth calls (SDK compatibility)."""
    return await sync_token(request, db)

@router.api_route("/sync-token", methods=["GET", "POST", "HEAD"])
@limiter.limit("10/minute")
async def sync_token(request: Request, db: Client = Depends(get_supabase)):
    """Internal SDK endpoint for session synchronization."""
    from backend.services.auth_service import get_token, get_current_active_user
    try:
        token = get_token(request)
        user = await get_current_active_user(request, token, db)
        return {"user": user, "status": "synced"}
    except Exception as e:
        # Return structured JSON even on failure to prevent frontend 'Invalid JSON' crashes
        return JSONResponse(status_code=401, content={"detail": str(e), "status": "unsynced"})

@router.post("/refresh")
@router.get("/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request, db: Client = Depends(get_supabase)):
    """SDK Token Refresh bridge."""
    return await sync_token(request, db)

@router.post("/logout")
async def logout(request: Request, db: Client = Depends(get_supabase)):
    """Ends the user session and invalidates the token."""
    from backend.services.auth_service import get_token
    try:
        token = get_token(request)
        # Using Supabase's auth.sign_out explicitly terminates on the server
        db.auth.sign_out()
        return JSONResponse(status_code=200, content={"status": "logged_out"})
    except Exception as e:
        logger.error(f"Error in /api/auth/logout: {e}")
        return JSONResponse(status_code=400, content={"detail": str(e), "status": "error"})

@router.get("/sessions")
@router.post("/sessions")
@limiter.limit("15/minute")
async def sessions_gate(request: Request, db: Client = Depends(get_supabase)):
    """SDK Session Management bridge."""
    return await sync_token(request, db)

@router.get("/sessions/current")
@limiter.limit("15/minute")
async def get_current_session(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token, get_current_active_user
    try:
        token = get_token(request)
        user = await get_current_active_user(request, token, db)
        return {"user": user}
    except Exception as e:
        logger.error(f"Error in /api/auth/sessions/current: {e}")
        raise HTTPException(status_code=401, detail=str(e))

v1_router = APIRouter(prefix="/auth/v1", tags=["Authentication-V1"])

@v1_router.get("/sessions/current", include_in_schema=False)
async def get_current_session_v1(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token, get_current_active_user
    token = get_token(request)
    user = await get_current_active_user(request, token, db)
    return {"user": user}

@v1_router.get("/user", include_in_schema=False)
async def get_user_info_v1(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token, get_current_active_user
    token = get_token(request)
    user = await get_current_active_user(request, token, db)
    return {"user": user}
