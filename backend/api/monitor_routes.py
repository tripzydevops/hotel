from fastapi import APIRouter, Depends, Query, BackgroundTasks, Request
from typing import List, Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user
from backend.models.schemas import MonitorResult, ScanOptions, QueryLog
from backend.services.monitor_service import trigger_monitor_logic, run_monitor_background
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["monitor"])

@router.post("/monitor/{user_id}", response_model=MonitorResult)
async def trigger_monitor(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    options: Optional[ScanOptions] = None,
    db: Client = Depends(get_supabase),
    current_active_user = Depends(get_current_active_user)
) -> MonitorResult:
    """
    Triggers a manual price scan for all hotels in the user's account.
    Fires the asynchronous Agent-Mesh in the background.
    """
    # EXPLANATION: Manual Price Scan Trigger
    # Initiates a full-account parity check across all configured providers.
    # Results are pushed via WebSocket or polled by the frontend.
    return await trigger_monitor_logic(
        user_id=user_id,
        background_tasks=background_tasks,
        options=options,
        db=db,
        current_user_id=str(user_id),
        current_user_email=getattr(current_active_user, 'email', None)
    )

@router.api_route("/trigger-scan/{user_id}", methods=["GET", "POST", "OPTIONS"])
async def check_scheduled_scan(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    request: Request,
    force: bool = Query(False),
    db: Optional[Client] = Depends(get_supabase)
):
    """Lazy cron workaround for Vercel free tier."""
    # Handle preflight OPTIONS explicitly (CORS)
    if request.method == "OPTIONS":
        return {"status": "ok"}

    # EXPLANATION: Frontend-Triggered Scheduler
    # This endpoint allows the frontend to 'tick' the scheduler when the user
    # visits the app, ensuring scans run even without a persistent cron.
    if not db:
        return {"triggered": False, "reason": "DB_UNAVAILABLE"}
    
    try:
        settings_result = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
        if not settings_result.data:
            return {"triggered": False, "reason": "NO_SETTINGS"}
        
        settings = settings_result.data[0]
        freq_minutes = settings.get("check_frequency_minutes", 0)
        if not force and freq_minutes <= 0:
            return {"triggered": False, "reason": "MANUAL_ONLY"}
        
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        hotels = hotels_result.data or []
        if not hotels:
            return {"triggered": False, "reason": "NO_HOTELS"}
        
        hotel_ids = [h["id"] for h in hotels]
        
        pending_scan = db.table("scan_sessions") \
            .select("created_at") \
            .eq("user_id", str(user_id)) \
            .in_("status", ["pending", "running"]) \
            .order("created_at", desc=True) \
            .limit(1).execute()
            
        if pending_scan.data:
            pending_time = datetime.fromisoformat(pending_scan.data[0]["created_at"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - pending_time).total_seconds() < 3600:
                 if not force:
                     return {"triggered": False, "reason": "ALREADY_PENDING"}
        
        should_run = force
        if not should_run:
            last_log = db.table("price_logs").select("recorded_at").in_("hotel_id", hotel_ids).order("recorded_at", desc=True).limit(1).execute()
            if not last_log.data:
                should_run = True
            else:
                last_run = datetime.fromisoformat(last_log.data[0]["recorded_at"].replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - last_run).total_seconds() / 60 >= freq_minutes:
                    should_run = True
        
        if should_run:
            session_id = None
            try:
                session_result = db.table("scan_sessions").insert({
                    "user_id": str(user_id),
                    "session_type": "scheduled" if not force else "manual_admin",
                    "hotels_count": len(hotels),
                    "status": "pending"
                }).execute()
                if session_result.data:
                    session_id = session_result.data[0]["id"]
            except Exception as e:
                print(f"LazyScheduler: Failed to create session: {e}")
            
            background_tasks.add_task(run_monitor_background, user_id=user_id, hotels=hotels, options=None, db=db, session_id=session_id)
            return {"triggered": True, "session_id": session_id}
        
        return {"triggered": False, "reason": "NOT_DUE"}
    except Exception as e:
        print(f"LazyScheduler error: {e}")
        return {"triggered": False, "reason": str(e)}

@router.get("/sessions/{session_id}/logs", response_model=List[QueryLog])
async def get_session_logs(session_id: UUID, db: Client = Depends(get_supabase)):
    """Fetch all query logs linked to a specific scan session."""
    try:
        result = db.table("query_logs").select("*").eq("session_id", str(session_id)).order("created_at", desc=True).execute()
        return result.data or []
    except Exception as e:
        print(f"Error fetching session logs: {e}")
        return []

@router.delete("/logs/{log_id}")
async def delete_log(log_id: UUID, db: Client = Depends(get_supabase), current_user = Depends(get_current_active_user)):
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
