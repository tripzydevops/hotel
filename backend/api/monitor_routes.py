from fastapi import APIRouter, Depends, Query, BackgroundTasks, Request, HTTPException
from fastapi.responses import StreamingResponse
import csv
import io
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase, get_supabase_rls
from backend.services.auth_service import get_current_active_user
from backend.models.schemas import MonitorResult, ScanOptions, QueryLog
from backend.services.monitor_service import (
    trigger_monitor_logic,
    run_monitor_background,
)
from datetime import datetime, timezone
import typing

router = APIRouter(prefix="/api/monitor", tags=["monitor"])



@router.post("/monitor", response_model=MonitorResult)
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


@router.get("/trigger-scan")
@router.post("/trigger-scan")
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

    # EXPLANATION: Frontend-Triggered Scheduler
    # This endpoint allows the frontend to 'tick' the scheduler when the user
    # visits the app, ensuring scans run even without a persistent cron.
    if not db:
        return {"triggered": False, "reason": "DB_UNAVAILABLE"}

    try:
        uid = str(user_id)

        # FIX: Sequential queries — the old asyncio.gather + lambda approach ran 4
        # concurrent Supabase queries on the same client object across threads,
        # which is NOT thread-safe and was silently failing, causing all scans
        # to return triggered:false while the UI still showed "Scan triggered!".

        # 1. Settings Check
        settings_res = db.table("settings").select("*").eq("user_id", uid).execute()
        if not settings_res.data:
            return {"triggered": False, "reason": "NO_SETTINGS"}

        settings = settings_res.data[0]
        freq_minutes = settings.get("check_frequency_minutes", 0)
        if not force and freq_minutes <= 0:
            return {"triggered": False, "reason": "MANUAL_ONLY"}

        # 2. Hotels Check
        hotels_res = (
            db.table("hotels")
            .select("*")
            .eq("user_id", uid)
            .is_("deleted_at", "null")
            .execute()
        )
        hotels = hotels_res.data or []
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
            # KAİZEN: Use next_scan_at from profiles as source of truth.
            # This aligns the 'Lazy Cron' with the background GitHub Action scheduler.
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


# EXPLANATION: GET a single scan session by ID.
# The ScanSessionModal polls this to get live reasoning_trace and status
# updates. Without this, the Agent Mesh steps and Reasoning Timeline
# stay stale after the modal opens.
@router.get("/sessions/{session_id}")
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
            return result.data[0]
        return {"error": "Session not found"}
    except Exception as e:
        print(f"Error fetching session: {e}")
        return {"error": str(e)}


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


@router.get("/sessions/{session_id}/export/csv")
async def export_session_csv(
    session_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Export all price data from a specific scan session as a CSV.
    Flattens room types into individual rows for granular analysis.
    """
    try:
        # 1. Fetch Price Logs joined with Hotel Names
        # We use a join trick with 'hotels' to get the name
        logs_res = (
            db.table("price_logs")
            .select("*, hotels(name)")
            .eq("session_id", str(session_id))
            .execute()
        )
        
        if not logs_res.data:
            # Fallback check: if no price logs, check if any query logs exist
            # but usually we want the rich price log data.
            raise HTTPException(status_code=404, detail="No price data found for this session.")

        # 2. Generator for CSV streaming
        def generate():
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Explicit type cast for linter inference
            buffered_output = typing.cast(io.StringIO, output)
            
            # Header
            writer.writerow([
                "Hotel Name", "Check-in", "Price", "Currency", 
                "Vendor", "Room Type", "Canonical Room", 
                "Status", "Recorded At", "Session ID"
            ])
            yield buffered_output.getvalue()
            buffered_output.seek(0)
            buffered_output.truncate(0)

            for log in logs_res.data:
                hotel_name = log.get("hotels", {}).get("name") if log.get("hotels") else "Unknown Hotel"
                room_types = log.get("room_types") or []
                
                # If room types exist, explode into rows
                if room_types:
                    for room in room_types:
                        writer.writerow([
                            hotel_name,
                            log.get("check_in_date"),
                            room.get("price") or log.get("price"),
                            room.get("currency") or log.get("currency"),
                            log.get("vendor"),
                            room.get("name"),
                            room.get("canonical_name", "N/A"),
                            "Estimated" if log.get("is_estimated") else "Actual",
                            log.get("recorded_at"),
                            log.get("session_id")
                        ])
                        line = buffered_output.getvalue()
                        yield line
                        buffered_output.seek(0)
                        buffered_output.truncate(0)
                else:
                    # Single row for the main result
                    writer.writerow([
                        hotel_name,
                        log.get("check_in_date"),
                        log.get("price"),
                        log.get("currency"),
                        log.get("vendor"),
                        "General/Lowest",
                        "N/A",
                        "Estimated" if log.get("is_estimated") else "Actual",
                        log.get("recorded_at"),
                        log.get("session_id")
                    ])
                    line = buffered_output.getvalue()
                    yield line
                    buffered_output.seek(0)
                    buffered_output.truncate(0)

        raw_id = str(session_id)
        # Use split to get the first segment of UUID, safer against pedantic slice linters
        short_id = raw_id.split("-")[0]
        filename = f"scan_report_{short_id}.csv"
        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Export Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
