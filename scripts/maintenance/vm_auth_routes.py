from typing import Dict, List, Any, Optional

from backend.models.schemas import SuccessResponse, TokenResponse, UserProfile
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.services.auth_service import get_current_active_user
from backend.utils.db import get_supabase
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)

# Routing Normalization
# Prefix is registered centrally in main.py.
router = APIRouter(tags=["Authentication"])


@router.get("/auth/user", include_in_schema=True, response_model=UserProfile)
async def get_user_info(request: Request, db: Client = Depends(get_supabase)):
    """Returns current user info."""
    from backend.services.auth_service import get_token

    try:
        token = get_token(request)
        user = await get_current_active_user(request, token, db)
        return {"user": user}
    except Exception as e:
        logger.error(f"Error in /api/auth/user: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.api_route("/auth", methods=["GET", "POST", "HEAD"], response_model=UserProfile)
@router.api_route("/auth/", methods=["GET", "POST", "HEAD"], response_model=UserProfile)
async def auth_root_sync(request: Request, db: Client = Depends(get_supabase)):
    """Unified endpoint for base /api/auth calls (SDK compatibility)."""
    return await sync_token(request, db)


@router.api_route("/auth/sync-token", methods=["GET", "POST", "HEAD"], response_model=TokenResponse)
async def sync_token(request: Request, db: Client = Depends(get_supabase)):
    """Internal SDK endpoint for session synchronization."""
    from backend.services.auth_service import get_token

    try:
        token = get_token(request)
        user = await get_current_active_user(request, token, db)
        return {"user": user, "status": "synced"}
    except Exception as e:
        # Return structured JSON even on failure to prevent frontend 'Invalid JSON' crashes
        return JSONResponse(
            status_code=401, content={"detail": str(e), "status": "unsynced"}
        )


@router.post("/auth/refresh", response_model=TokenResponse)
@router.get("/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, db: Client = Depends(get_supabase)):
    """SDK Token Refresh bridge."""
    return await sync_token(request, db)


@router.get("/auth/sessions", response_model=List[Dict[str, Any]])
@router.post("/auth/sessions", response_model=SuccessResponse)
async def sessions_gate(request: Request, db: Client = Depends(get_supabase)):
    """SDK Session Management bridge."""
    return await sync_token(request, db)


@router.get("/auth/sessions/current", response_model=Dict[str, Any])
async def get_current_session(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token

    try:
        token = get_token(request)
        user = await get_current_active_user(request, token, db)
        return {"user": user}
    except Exception as e:
        logger.error(f"Error in /api/auth/sessions/current: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.api_route("/auth/token", methods=["GET", "POST", "HEAD"], response_model=TokenResponse)
async def auth_token_bridge(request: Request, db: Client = Depends(get_supabase)):
    """SDK Token Bridge for session synchronization."""
    return await sync_token(request, db)


v1_router = APIRouter(tags=["Authentication-V1"])


@v1_router.get("/auth/v1/sessions/current", include_in_schema=False)
async def get_current_session_v1(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token

    token = get_token(request)
    user = await get_current_active_user(request, token, db)
    return {"user": user}


@v1_router.get("/user", include_in_schema=False)
async def get_user_info_v1(request: Request, db: Client = Depends(get_supabase)):
    from backend.services.auth_service import get_token

    token = get_token(request)
    user = await get_current_active_user(request, token, db)
    return {"user": user}
