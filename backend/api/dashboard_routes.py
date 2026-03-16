from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user, UserIdentity
from backend.services.dashboard_service import get_dashboard_logic, get_recent_wins, DashboardData
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["dashboard"])

@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(
    request: Request,
    user_id: Optional[str] = None,
    current_user: UserIdentity = Depends(get_current_active_user),
    db: Client = Depends(get_supabase)
):
    """
    Dashboard entry point with deep diagnostics.
    """
    auth_header = request.headers.get("Authorization")
    masked_token = f"{auth_header[:15]}...{auth_header[-5:]}" if auth_header else "MISSING"
    
    logger.info(f"DASHBOARD_AUDIT: User={current_user.email} (ID={current_user.id}) RequestID={user_id} Token={masked_token}")
    
    # Force the dash to fetch for the ACTUAL authenticated user if no specific ID requested
    target_id = user_id or str(current_user.id)
    
    try:
        return await get_dashboard_logic(
            user_id=target_id,
            current_user_id=str(current_user.id),
            current_user_email=current_user.email,
            db=db
        )
    except Exception as e:
        logger.error(f"DASHBOARD_ERROR for {target_id}: {str(e)}")
        raise e


@router.get("/global-pulse")
async def get_global_pulse(db: Client = Depends(get_supabase)):
    """
    Fetches recent price drops discovered by the Global Pulse network.
    Anonymized and available to all users to show 'Community Intelligence'.
    """
    # [KAIZEN] Standardized top-level import used here

    wins = await get_recent_wins(db)
    return JSONResponse(content=jsonable_encoder(wins))
