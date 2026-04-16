from fastapi import APIRouter, Depends, Query, BackgroundTasks, Request
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase, try_acquire_lock
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.models.schemas import MonitorResult, ScanOptions, QueryLog, ScanSession
from backend.services import monitor_service
from datetime import datetime, timezone

router = APIRouter(prefix="/monitor", tags=["monitor"])
# Redundant router for Vercel prefix flexibility
router_legacy = APIRouter(tags=["monitor"])



@router.get("/sessions/{session_id}", response_model=ScanSession)
async def get_session(
    session_id: UUID, 
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user)
):
    """Fetch a single scan session by ID for live status/reasoning updates."""
    try:
        result = (
            db.table("scan_sessions").select("*").eq("id", str(session_id)).execute()
        )
        if result.data:
            return ScanSession.model_validate(result.data[0])
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        if not isinstance(e, HTTPException):
            print(f"Error fetching session: {e}")
        raise e


@router.get("/sessions/{session_id}/logs", response_model=List[QueryLog])
async def get_session_logs(
    session_id: UUID, 
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user)
):
    """Fetch all query logs linked to a specific scan session."""
    try:
        result = (
            db.table("query_logs")
            .select("*")
            .eq("session_id", str(session_id))
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"Error fetching session logs: {e}")
        return []


@router.delete("/logs/{log_id}")
async def delete_log(
    log_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Deletes a specific activity log.
    Supports frontend's cleanup functionality.
    """
    try:
        db.table("query_logs").delete().eq("id", str(log_id)).execute()
        return {"status": "success"}
    except Exception as e:
        print(f"Error deleting log: {e}")
        return {"status": "error", "detail": str(e)}


@router.get("/active-tasks", response_model=List)
async def honey_pot_tasks(request: Request):
    """
    Honey Pot route to identify and log rogue services pinging the system.
    Returns empty list to stop 404 spam.
    """
    print(f"\n[IDENTIFIED] Rogue pinger caught! IP: {request.client.host} | User-Agent: {request.headers.get('user-agent')}\n")
    return []

