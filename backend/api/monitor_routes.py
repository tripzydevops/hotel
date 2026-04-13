from fastapi import APIRouter, Depends, Query, BackgroundTasks, Request
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase, try_acquire_lock
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.models.schemas import MonitorResult, ScanOptions, QueryLog, ScanSession
from backend.services import monitor_service
from backend.services.monitor_service import (
    trigger_monitor_logic,
    run_monitor_background,
)
from datetime import datetime, timezone

router = APIRouter(prefix="/monitor", tags=["monitor"])
# Redundant router for Vercel prefix flexibility
router_legacy = APIRouter(tags=["monitor"])


@router.get("/active-tasks", response_model=List[str])
async def get_active_tasks(
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Returns a list of hotel IDs that currently have a 'pending' scan task.
    Used for real-time UI indicators (e.g. ScanStatusIndicator).
    """
    try:
        # We query scan_tasks where status is pending for the given user.
        # Note: We filter by user_id to ensure RLS and privacy.
        result = (
            db.table("scan_tasks")
            .select("hotel_id")
            .eq("status", "pending")
            .eq("user_id", str(current_user.id))
            .execute()
        )
        # Return unique hotel IDs
        hotel_ids = list(set([item["hotel_id"] for item in (result.data or [])]))
        return hotel_ids
    except Exception as e:
        print(f"Error fetching active tasks: {e}")
        return []



@router.post("", response_model=MonitorResult)
async def trigger_monitor(
    background_tasks: BackgroundTasks,
    options: Optional[ScanOptions] = None,
    db: Client = Depends(get_supabase_rls),
    current_active_user=Depends(get_current_active_user),
) -> MonitorResult:
    """
    Triggers a manual price scan for all hotels in the user's account.
    """
    user_id = current_active_user.id
    return await trigger_monitor_logic(
        user_id=user_id,
        background_tasks=background_tasks,
        options=options,
        db=db,
        current_user_id=str(user_id),
        current_user_email=getattr(current_active_user, "email", None),
    )


@router.get("/trigger")
@router.post("/trigger")
@router.get("/trigger-scan", include_in_schema=False)
@router.post("/trigger-scan", include_in_schema=False)
@router_legacy.get("/trigger-scan")
@router_legacy.post("/trigger-scan")
async def check_scheduled_scan(
    background_tasks: BackgroundTasks,
    request: Request,
    force: bool = Query(False),
    db: Optional[Client] = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Lazy cron workaround for Vercel. 
    1. If force=True, scans all of this user's hotels immediately.
    2. If force=False, triggers the Global Heartbeat (4-hour system scan).
    """
    user_id = current_user.id

    if not db:
        return {"triggered": False, "reason": "DB_UNAVAILABLE"}

    # ATOMIC LOCK: Prevent multiple concurrent scheduler ticks
    # Use a global lock for pulses, or per-user lock for force scans
    lock_name = f"scan_lock_{user_id}" if force else "global_scheduler_tick"
    if not try_acquire_lock(db, lock_name, expire_seconds=60):
        return {"triggered": False, "reason": "LOCK_HELD"}

    if not force:
        # TRIGGER GLOBAL SYSTEM HEARTBEAT
        # This handles the 4-hour interval logic for EVERYONE.
        background_tasks.add_task(monitor_service.run_system_heartbeat, db)
        background_tasks.add_task(monitor_service.process_system_scans, db)
        return {"triggered": True, "type": "heartbeat_pulse"}

    # FORCE SCAN FOR CURRENT USER
    try:
        uid = str(user_id)
        # Fetch monitored hotels for this user
        monitored_res = (
            db.table("user_hotels")
            .select("hotel_id, hotels(*)")
            .eq("user_id", uid)
            .eq("is_monitored", True)
            .execute()
        )
        
        hotels_data = []
        for item in (monitored_res.data or []):
            if item.get("hotels"):
                hotels_data.append(item["hotels"])

        if not hotels_data:
            return {"triggered": False, "reason": "NO_MONITORED_HOTELS"}

        # Create a session for tracking
        session_id = None
        try:
            session_result = (
                db.table("scan_sessions")
                .insert({
                    "user_id": uid,
                    "session_type": "manual",
                    "hotels_count": len(hotels_data),
                    "status": "pending",
                })
                .execute()
            )
            if session_result.data:
                session_id = session_result.data[0]["id"]
        except Exception as e:
            print(f"[TriggerScan] Session create failed: {e}")

        background_tasks.add_task(
            run_monitor_background,
            user_id=user_id,
            hotels=hotels_data,
            options=None,
            db=db,
            session_id=session_id,
        )

        return {"triggered": True, "type": "force_scan", "session_id": session_id}

    except Exception as e:
        print(f"[TriggerScan] Error: {e}")
        return {"triggered": False, "reason": str(e)}


# GET a single scan session by ID.
# Live status updates.
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
