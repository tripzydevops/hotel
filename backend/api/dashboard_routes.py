from typing import Dict, Any

from backend.models.schemas import DashboardResponse
from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.services.dashboard_service import get_dashboard_logic, get_recent_wins
from backend.utils.db import get_supabase
from supabase import Client

# EXPLANATION: Routing Normalization (Regression Fix)
# Removed "/api" prefix from APIRouter to avoid doubled paths
# (e.g., /api/api/dashboard/...) when registered in main.py.
router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: Client = Depends(get_supabase_rls),
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


@router.get("/debug-gemini")
async def debug_gemini():
    import os
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not gemini_key:
        return {"status": "missing", "preview": None, "has_genai": False}
    
    try:
        from google import genai
        has_genai = True
    except ImportError:
        has_genai = False
        
    return {
        "status": "loaded",
        "has_genai": has_genai,
        "key_length": len(gemini_key),
        "prefix": gemini_key[:5] if len(gemini_key) >= 5 else "",
        "suffix": gemini_key[-5:] if len(gemini_key) >= 5 else "",
    }


@router.get("/global-pulse", response_model=Dict[str, Any])
async def get_global_pulse(db: Client = Depends(get_supabase)):
    """
    Fetches recent price drops discovered by the Global Pulse network.
    Anonymized and available to all users to show 'Community Intelligence'.
    """
    # [KAIZEN] Standardized top-level import used here

    wins = await get_recent_wins(db)
    return JSONResponse(content=jsonable_encoder(wins))
