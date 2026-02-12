from fastapi import APIRouter, Depends
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user
from backend.services.dashboard_service import get_dashboard_logic
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/api", tags=["dashboard"])

@router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: UUID, db: Client = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """
    Main dashboard data aggregator.
    Fetches the user's primary hotel, its competitors, and recent price trends.
    Used to populate the main analytics overview.
    """
    data = await get_dashboard_logic(
        user_id=str(user_id),
        current_user_id=str(current_user.id),
        current_user_email=getattr(current_user, 'email', None),
        db=db
    )
    return JSONResponse(content=jsonable_encoder(data))
