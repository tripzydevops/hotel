from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Any
from backend.services.auth_service import get_current_active_user
from backend.utils.db import get_supabase
from supabase import Client
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/user", include_in_schema=True)
async def get_user_info(request: Request, db: Client = Depends(get_supabase)):
    """Returns current user info."""
    from backend.services.auth_service import get_token, get_current_active_user
    try:
        token = get_token(request)
        user = await get_current_active_user(token, db)
        return {"user": user}
    except Exception as e:
        logger.error(f"Error in /api/auth/user: {e}")
        raise HTTPException(status_code=401, detail=str(e))

@router.api_route("", methods=["GET", "POST", "HEAD"])
@router.api_route("/", methods=["GET", "POST", "HEAD"])
async def auth_root_sync(request: Request, db: Client = Depends(get_supabase)):
    """Unified endpoint for base /api/auth calls (SDK compatibility)."""
    return await sync_token(request, db)

@router.api_route("/sync-token", methods=["GET", "POST", "HEAD"])
async def sync_token(request: Request, db: Client = Depends(get_supabase)):
    """Internal SDK endpoint for session synchronization."""
    from backend.services.auth_service import get_token, get_current_active_user
    try:
        token = get_token(request)
        user = await get_current_active_user(token, db)
        return {"user": user, "status": "synced"}
    except Exception as e:
        # Return structured JSON even on failure to prevent frontend 'Invalid JSON' crashes
        return JSONResponse(status_code=401, content={"detail": str(e), "status": "unsynced"})

@router.get("/sessions/current")
async def get_current_session(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token, get_current_active_user
    try:
        token = get_token(request)
        user = await get_current_active_user(token, db)
        return {"user": user}
    except Exception as e:
        logger.error(f"Error in /api/auth/sessions/current: {e}")
        raise HTTPException(status_code=401, detail=str(e))

v1_router = APIRouter(prefix="/auth/v1", tags=["Authentication-V1"])

@v1_router.get("/sessions/current", include_in_schema=False)
async def get_current_session_v1(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token, get_current_active_user
    token = get_token(request)
    user = await get_current_active_user(token, db)
    return {"user": user}

@v1_router.get("/user", include_in_schema=False)
async def get_user_info_v1(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token, get_current_active_user
    token = get_token(request)
    user = await get_current_active_user(token, db)
    return {"user": user}
