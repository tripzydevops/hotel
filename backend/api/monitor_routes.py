
from backend.models.schemas import SuccessResponse
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from backend.utils.logger import get_logger

logger = get_logger(__name__)

from backend.models.schemas import QueryLog, ScanSession
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.utils.security import verify_scan_session_ownership
from supabase import Client

router = APIRouter(prefix="/monitor", tags=["monitor"])
# Redundant router for Vercel prefix flexibility
router_legacy = APIRouter(tags=["monitor"])


@router.get("/sessions/{session_id}", response_model=ScanSession)
async def get_session(
    session_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Fetch a single scan session by ID for live status/reasoning updates."""
    # IDOR GUARD: Verify user owns the session's hotel
    await verify_scan_session_ownership(db, str(current_user.id), str(session_id))

    try:
        result = (
            db.table("scan_sessions").select("*").eq("id", str(session_id)).execute()
        )
        if result.data:
            return ScanSession.model_validate(result.data[0])
        raise HTTPException(status_code=404, detail="Session not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching session: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch session")


@router.get("/sessions/{session_id}/logs", response_model=List[QueryLog])
async def get_session_logs(
    session_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Fetch all query logs linked to a specific scan session."""
    # IDOR GUARD: Verify user owns the session's hotel
    await verify_scan_session_ownership(db, str(current_user.id), str(session_id))

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
        logger.error(f"Error fetching session logs: {e}")
        return []


@router.delete("/logs/{log_id}", response_model=SuccessResponse)
async def delete_log(
    log_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Deletes a specific activity log.
    Supports frontend's cleanup functionality.
    """
    # IDOR GUARD: Verify the log's parent session belongs to this user
    try:
        log_res = (
            db.table("query_logs")
            .select("session_id")
            .eq("id", str(log_id))
            .maybe_single()
            .execute()
        )
        if not log_res.data:
            raise HTTPException(status_code=404, detail="Log not found")

        session_id = log_res.data.get("session_id")
        if session_id:
            await verify_scan_session_ownership(
                db, str(current_user.id), str(session_id)
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Log ownership check failed: {e}")
        raise HTTPException(status_code=403, detail="Log ownership verification failed")

    try:
        db.table("query_logs").delete().eq("id", str(log_id)).execute()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting log: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete log")


@router.get("/active-tasks", response_model=List)
async def honey_pot_tasks(request: Request):
    """
    Honey Pot route to identify and log rogue services pinging the system.
    Returns empty list to stop 404 spam.
    """
    logger.warning(
        f"[IDENTIFIED] Rogue pinger caught! IP: {request.client.host} | User-Agent: {request.headers.get('user-agent')}"
    )
    return []
