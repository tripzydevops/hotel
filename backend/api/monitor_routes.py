from fastapi import APIRouter, Depends, Query, BackgroundTasks, Request
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase, try_acquire_lock
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.models.schemas import MonitorResult, ScanOptions, QueryLog, ScanSession
from backend.services.monitor_service import (
    trigger_monitor_logic,
    run_monitor_background,
)
from datetime import datetime, timezone

router = APIRouter(prefix="/monitor", tags=["monitor"])
# Redundant router for Vercel prefix flexibility
router_legacy = APIRouter(tags=["monitor"])



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
    """Lazy cron workaround for Vercel free tier."""
    user_id = current_user.id

    try:
        # Frontend-Triggered Scheduler
        # This endpoint allows the frontend to 'tick' the scheduler when the user
        # visits the app, ensuring scans run even without a persistent cron.
        if not db:
            return {"triggered": False, "reason": "DB_UNAVAILABLE"}

        uid = str(user_id)

        # ATOMIC LOCK: Prevent multiple concurrent scheduler ticks
        # We lock for 30 seconds - enough for the 'who is due' logic to complete.
        if not force:
            if not try_acquire_lock(db, "global_scheduler_tick", expire_seconds=30):
                return {"triggered": False, "reason": "LOCK_HELD"}

        # Sequential queries for thread safety
        # 1. Settings Check
        settings_res = db.table("settings").select("*").eq("user_id", uid).execute()
        if not settings_res.data:
            return {"triggered": False, "reason": "NO_SETTINGS"}

        settings = settings_res.data[0]
        freq_minutes = settings.get("check_frequency_minutes", 0)
        if not force and freq_minutes <= 0:
            return {"triggered": False, "reason": "MANUAL_ONLY"}

        # 2. Hotels Check
        res = (
            db.table("hotels")
            .select("*")
            .eq("user_id", uid)
            .execute()
        )
        # Programmatic filtering to avoid Supabase client version ambiguity with .is_("null")
        hotels = [h for h in (res.data or []) if not h.get("deleted_at")]
        if not hotels:
            return {"triggered": False, "reason": "NO_HOTELS"}

        # 3. Pending/Running Check (Anti-Collision — skipped when force=True)
        if not force:
            pending_res = (
                db.table("scan_sessions")
                .select("created_at")
                .eq("user_id", uid)
                .in_("status", ["pending", "running"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if pending_res.data:
                pending_time = datetime.fromisoformat(
                    pending_res.data[0]["created_at"].replace("Z", "+00:00")
                )
                if (datetime.now(timezone.utc) - pending_time).total_seconds() < 3600:
                    return {"triggered": False, "reason": "ALREADY_PENDING"}

        # 4. Due Check (skipped entirely when force=True)
        should_run = force
        if not should_run:
            # Use next_scan_at from profiles as source of truth.
            profile_res = db.table("profiles").select("next_scan_at").eq("id", uid).execute()
            if profile_res.data:
                nxt = profile_res.data[0].get("next_scan_at")
                if not nxt:
                    should_run = True  # New profile, never scanned
                else:
                    try:
                        nxt_dt = datetime.fromisoformat(nxt.replace("Z", "+00:00"))
                        if datetime.now(timezone.utc) >= nxt_dt:
                            should_run = True
                    except Exception:
                        should_run = True
            else:
                should_run = True

        if should_run:
            session_id = None
            try:
                session_result = (
                    db.table("scan_sessions")
                    .insert(
                        {
                            "user_id": uid,
                            "session_type": "manual" if force else "scheduled",
                            "hotels_count": len(hotels),
                            "status": "pending",
                        }
                    )
                    .execute()
                )
                if session_result.data:
                    session_id = session_result.data[0]["id"]
                    print(f"[TriggerScan] Created session {session_id} for {uid}")
            except Exception as e:
                print(f"[TriggerScan] Session create failed: {e}")

            background_tasks.add_task(
                run_monitor_background,
                user_id=user_id,
                hotels=hotels,
                options=None,
                db=db,
                session_id=session_id,
            )
            return {"triggered": True, "session_id": session_id}

        return {"triggered": False, "reason": "NOT_DUE"}
    except Exception as e:
        print(f"[TriggerScan] Unhandled error: {e}")
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
