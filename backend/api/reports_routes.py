from fastapi import APIRouter, Depends
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user
from backend.services.admin_service import get_reports_logic, export_report_logic
from backend.models.schemas import BaseModel

router = APIRouter(prefix="/api/reports", tags=["reports"])

class ReportRequest(BaseModel):
    hotel_ids: List[str]
    period_months: int
    title: Optional[str] = None
    comparison_mode: bool = False

@router.get("/{user_id}")
async def get_reports(user_id: UUID, db: Client = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """
    Lists all reports generated for a specific user.
    """
    return await get_reports_logic(user_id, db)

@router.post("/{user_id}/export")
async def export_report(user_id: UUID, format: str = "csv", db: Client = Depends(get_supabase)):
    """
    Triggers a data export (CSV/Excel) for a specific user report.
    Delegates generation to admin_service.
    """
    return await export_report_logic(user_id, format, db)
