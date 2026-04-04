from fastapi import APIRouter, Depends
from uuid import UUID
from typing import Any
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.services.dashboard_service import get_dashboard_logic, get_recent_wins
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard(
    db: Any = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Main dashboard data aggregator.
    """
    user_id = current_user.id
    data = await get_dashboard_logic(
        user_id=str(user_id),
        current_user_id=str(current_user.id),
        current_user_email=getattr(current_user, "email", None),
        db=db,
    )
    return JSONResponse(content=jsonable_encoder(data))


@router.get("/global-pulse")
async def get_global_pulse(db: Any = Depends(get_supabase)):
    """
    Fetches recent price drops discovered by the Global Pulse network.
    Anonymized and available to all users to show 'Community Intelligence'.
    """
    # [KAIZEN] Standardized top-level import used here

    wins = await get_recent_wins(db)
    return JSONResponse(content=jsonable_encoder(wins))
