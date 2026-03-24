from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from backend.services.auth_service import get_current_active_user
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/user")
async def get_user_info(current_user: Any = Depends(get_current_active_user)):
    """
    Returns the current authenticated user's profile information.
    This endpoint is used by the frontend SDK/middleware for session validation.
    """
    try:
        # Note: current_user is already verified by get_current_active_user dependency
        return {"user": current_user}
    except Exception as e:
        logger.error(f"Error in /api/auth/user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during user retrieval")

@router.get("/sessions/current")
async def get_current_session(current_user: Any = Depends(get_current_active_user)):
    """
    Returns the current active session information.
    Matches the 'sessions/current' path pattern expected by internal service calls.
    """
    try:
        return {"user": current_user}
    except Exception as e:
        logger.error(f"Error in /api/auth/sessions/current: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during session retrieval")

v1_router = APIRouter(prefix="/auth/v1", tags=["Authentication-V1"])

@v1_router.get("/sessions/current", include_in_schema=False)
async def get_current_session_v1(current_user: Any = Depends(get_current_active_user)):
    return {"user": current_user}

@v1_router.get("/user", include_in_schema=False)
async def get_user_info_v1(current_user: Any = Depends(get_current_active_user)):
    return {"user": current_user}
