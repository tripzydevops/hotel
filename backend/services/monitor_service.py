"""
Monitor Service.
Orchestrates the asynchronous background AI Agent-Mesh for price monitoring.
"""
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

import os
import sys
import logging
import traceback
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import BackgroundTasks, HTTPException
from supabase import Client

from backend.models.schemas import ScanOptions, MonitorResult
# from backend.agents.scraper_agent import ScraperAgent
# from backend.agents.analyst_agent import AnalystAgent
# from backend.agents.notifier_agent import NotifierAgent

# EXPLANATION: Dedicated Scheduler Logging
# We use a separate logger and file handler for the scheduler to make 
# background execution easily auditable without cluttering main logs.
def get_scheduler_logger():
    s_logger = logging.getLogger("scheduler")
    if not s_logger.handlers:
        from logging.handlers import RotatingFileHandler
        # EXPLANATION: Environment-Aware Log Path
        # The VM uses a fixed path; GitHub Actions and local dev use a relative path.
        # This prevents crashes when the scheduler runs outside the VM.
        vm_path = "/home/successofmentors/.gemini/antigravity/scratch/hotel/scheduler.log"
        local_path = os.path.join(os.path.dirname(__file__), "..", "..", "scheduler.log")
        
        log_path = vm_path if os.path.isdir(os.path.dirname(vm_path)) else os.path.abspath(local_path)
        
        try:
            handler = RotatingFileHandler(log_path, maxBytes=5*1024*1024, backupCount=3)
        except (OSError, PermissionError):
            # Final fallback: stream to stdout (visible in GitHub Actions logs)
            handler = logging.StreamHandler()
        
        formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] %(message)s')
        handler.setFormatter(formatter)
        s_logger.addHandler(handler)
        s_logger.setLevel(logging.INFO)
        s_logger.propagate = False
    return s_logger

async def trigger_monitor_logic(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    options: Optional[ScanOptions],
    db: Client,
    current_user_id: str,
    current_user_email: Optional[str]
) -> MonitorResult:
    """
    Main trigger for price monitoring.
    Enforces limits, normalizes dates, and launches the background orchestrator.
    
    Reminder Note: Standard users are limited to daily manual scan quotas.
    Enterprise users have unlimited background agent cycles.
    """
    
    # Get all hotels for user
    hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    hotels = hotels_result.data or []
    
    if not hotels:
        return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0)
        
    # 1. ADMIN BYPASS / LIMIT ENFORCEMENT
    try:
        is_admin = False
        profile_res = db.table("user_profiles").select("role").eq("user_id", str(current_user_id)).execute()
        if profile_res.data and profile_res.data[0].get("role") in ["admin", "market_admin", "market admin"]:
            is_admin = True

        if not is_admin:
            # Enforce Limits
            plan_type = "starter"
            profiles_res = db.table("profiles").select("plan_type").eq("id", str(user_id)).execute()
            if profiles_res.data:
                plan_type = profiles_res.data[0].get("plan_type", "starter")
            
            # Fetch tier config
            tier_res = db.table("tier_configs").select("manual_scans_per_day").eq("plan_type", plan_type).execute()
            daily_manual_limit = tier_res.data[0].get("manual_scans_per_day", 0) if tier_res.data else 0
            
            # Legacy monthly limit
            plan_res = db.table("plans").select("monthly_scan_limit").eq("name", plan_type).execute()
            monthly_total_limit = plan_res.data[0].get("monthly_scan_limit", 500) if plan_res.data else 500
            
            # Recent scan counts
            today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
            daily_manual_res = db.table("scan_sessions").select("id", count="exact").eq("user_id", str(user_id)).eq("session_type", "manual").gte("created_at", today_start).execute()
            current_daily_manual = daily_manual_res.count or 0
            
            first_day = datetime(datetime.now().year, datetime.now().month, 1).isoformat()
            monthly_total_res = db.table("scan_sessions").select("id", count="exact").eq("user_id", str(user_id)).gte("created_at", first_day).execute()
            current_monthly_total = monthly_total_res.count or 0
            
            if daily_manual_limit <= 0:
                return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=["MANUAL_SCAN_RESTRICTED"])

            if current_daily_manual >= daily_manual_limit:
                return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=[f"DAILY_LIMIT_REACHED ({daily_manual_limit})"])
                
            if current_monthly_total >= monthly_total_limit:
                 return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=[f"MONTHLY_LIMIT_REACHED ({monthly_total_limit})"])
            
    except Exception as e:
        logger.error(f"Limit check exception: {e}")

    # 2. DEFAULT DATES NORMALIZATION
    check_in = options.check_in if options and options.check_in else None
    check_out = options.check_out if options and options.check_out else None
    
    today = date.today()
    if (not check_in) or (str(check_in) == str(today)):
        # Late night advances for Google Travel reliability
        if datetime.now().hour >= 18:
            check_in = today + timedelta(days=1)
    
    if not check_in:
        check_in = today
    if not check_out:
        check_out = check_in + timedelta(days=1)
    elif check_out <= check_in:
        check_out = check_in + timedelta(days=1)
        
    adults = options.adults if options and options.adults else 2
    currency = options.currency if options and options.currency else "TRY"

    # 3. Create Session
    session_id = None
    try:
        session_result = db.table("scan_sessions").insert({
            "user_id": str(user_id),
            "session_type": "manual",
            "hotels_count": len(hotels),
            "status": "pending",
            "check_in_date": str(check_in),
            "check_out_date": str(check_out),
            "adults": adults,
            "currency": currency
        }).execute()
        if session_result.data:
            session_id = session_result.data[0]["id"]
    except Exception as e:
        logger.error(f"Session creation failed: {e}")

    # Normalized Options for Background task
    normalized_options = ScanOptions(
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        currency=currency
    )

    # 4. Background Execution (Direct → Celery Fallback)
    # EXPLANATION: Direct Execution Priority
    # Previously this dispatched exclusively to Celery/Redis, requiring the VM worker
    # to be alive. Now we use FastAPI's BackgroundTasks for direct in-process execution,
    # which works reliably on Vercel serverless. Celery is kept as a fallback only.
    try:
        if background_tasks is not None:
            # Primary: Execute directly via FastAPI BackgroundTasks
            trace_msg = "Executing scan directly via BackgroundTasks"
            logger.info(trace_msg)
            
            if session_id:
                try:
                    db.table("scan_sessions").update({
                        "reasoning_trace": [trace_msg]
                    }).eq("id", str(session_id)).execute()
                except: pass
            
            # Lazy import
            from backend.services.monitor_service import run_monitor_background
            background_tasks.add_task(
                run_monitor_background,
                user_id=user_id,
                hotels=hotels,
                options=normalized_options,
                db=db,
                session_id=UUID(session_id) if session_id else None
            )
            logger.info(f"Direct execution queued for session {session_id}")
        else:
            # Fallback: Celery dispatch (only if BackgroundTasks unavailable)
            raise RuntimeError("BackgroundTasks not available, falling back to Celery")
    except Exception as e:
        logger.warning(f"Direct execution failed ({e}), trying Celery fallback...")
        try:
            from backend.celery_app import celery_app
            task_args = {
                "user_id": str(user_id),
                "hotels": hotels,
                "options_dict": normalized_options.model_dump() if normalized_options else None,
                "session_id": str(session_id) if session_id else None
            }
            celery_app.send_task("backend.tasks.run_scan_task", kwargs=task_args)
            logger.info(f"Celery fallback dispatched for session {session_id}")
            
            if session_id:
                try:
                    db.table("scan_sessions").update({
                        "reasoning_trace": ["Dispatched via Celery fallback"]
                    }).eq("id", str(session_id)).execute()
                except: pass
        except Exception as fallback_e:
            logger.critical(f"Both direct and Celery dispatch failed: {fallback_e}")

    return MonitorResult(
        hotels_checked=len(hotels),
        prices_updated=0,
        alerts_generated=0,
        session_id=UUID(session_id) if session_id else None,
        errors=[]
    )

async def run_monitor_background(
    user_id: UUID,
    hotels: List[Dict[str, Any]],
    options: Optional[ScanOptions],
    db: Client,
    session_id: Optional[UUID]
):
    """
    Background orchestrator. Mission Control for specialized AI agents.
    """
    try:
        # 1. Initialize Agents (Lazy Loading)
        from backend.agents.scraper_agent import ScraperAgent
        from backend.agents.analyst_agent import AnalystAgent
        from backend.agents.notifier_agent import NotifierAgent
        
        scraper = ScraperAgent(db)
        analyst = AnalystAgent(db)
        notifier = NotifierAgent()

        # 2. Get User Threshold
        threshold = 2.0
        try:
            settings_res = db.table("settings").select("threshold_percent").eq("user_id", str(user_id)).execute()
            if settings_res.data:
                threshold = settings_res.data[0].get("threshold_percent", 2.0)
        except Exception: pass

        # 3. Phase 1: Scraper Agent
        logger.info(f"Starting ScraperAgent for {len(hotels)} hotels...")
        scraper_results = await scraper.run_scan(user_id, hotels, options, session_id)

        # 4. Phase 2: Analyst Agent
        logger.info("Starting AnalystAgent...")
        analysis = await analyst.analyze_results(user_id, scraper_results, threshold, options=options, session_id=session_id)

        # 4.5 Room Type Cataloging
        try:
            from backend.services.room_type_service import update_room_type_catalog
            await update_room_type_catalog(db, scraper_results, hotels)
        except Exception as e:
            logger.warning(f"Room Catalog failure: {e}")

        # 5. Phase 3: Notifier Agent
        if analysis.get("alerts"):
            try:
                settings_res = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
                settings = settings_res.data[0] if settings_res.data else None
                if settings:
                    hotel_name_map = {h["id"]: h["name"] for h in hotels}
                    await notifier.dispatch_alerts(analysis["alerts"], settings, hotel_name_map)
            except Exception as e:
                logger.warning(f"Notifier failure: {e}")

        # 6. Finalize Session
        final_status = "completed"
        if any(res.get("status") != "success" for res in scraper_results):
            final_status = "partial"
        
        if session_id:
            db.table("scan_sessions").update({
                "status": final_status,
                "completed_at": datetime.now().isoformat()
            }).eq("id", str(session_id)).execute()

    except Exception as e:
        logger.critical(f"SYSTEM FAILURE: {e}")
        traceback.print_exc()
        if session_id:
            try:
                db.table("scan_sessions").update({
                    "status": "failed",
                    "completed_at": datetime.now().isoformat()
                }).eq("id", str(session_id)).execute()
            except: pass

async def run_scheduler_check_logic():
    """
    [CRITICAL BACKGROUND LOGIC]
    Core engine for the persistent background scheduler.
    
    FEATURE OVERVIEW:
    - Resolves 'Lazy Cron' by running independently of frontend traffic.
    - Uses a multi-layered trigger (VM Cron + GitHub Actions).
    - Ensures scans are dispatched to Celery workers for asynchronous processing.
    
    FLOW:
    1. Identifies active users whose 'next_scan_at' timestamp is in the past.
    2. Calculates the 'next_run' interval based on user settings (default: 24h).
    3. Updates 'next_scan_at' immediately to act as a soft-lock (preventing duplicate dispatches).
    4. Dispatches the scan task to the Redis/Celery queue for VM-side execution.
    """
    s_logger = get_scheduler_logger()
    s_logger.info("CRON: Starting scheduler check...")
    from backend.utils.db import get_supabase
    try:
        supabase = get_supabase()
        if not supabase:
            logger.error("CRON: Database unavailable")
            return

        # 1. Get all active users with schedules due
        # KAİZEN: Robust ISO format for Supabase comparison (YYYY-MM-DDTHH:MM:SSZ)
        now_dt = datetime.now(timezone.utc).replace(microsecond=0)
        now_iso = now_dt.isoformat().replace("+00:00", "Z")
        s_logger.info(f"CRON: Checking for scans due before {now_iso}")
        
        # 1.1 Fetch all active profiles
        result = supabase.table("profiles").select("id, next_scan_at, scan_frequency_minutes, subscription_status") \
            .lte("next_scan_at", now_iso) \
            .eq("subscription_status", "active") \
            .execute()
        
        active_due = result.data or []
        s_logger.info(f"CRON: Found {len(active_due)} active profiles due for scan.")
        
        if not active_due:
            return

        # 1.2 Fetch actual user settings for frequency override
        due_ids = [u['id'] for u in active_due]
        settings_res = supabase.table("settings").select("user_id, check_frequency_minutes").in_("user_id", due_ids).execute()
        settings_map = {s['user_id']: s['check_frequency_minutes'] for s in settings_res.data or []}

        # 1.3 Pool all hotels
        hotels_res = supabase.table("hotels").select("*").in_("user_id", due_ids).execute()
        all_hotels = hotels_res.data or []
        
        # Group hotels by user for processing
        user_hotels_map = {}
        for h in all_hotels:
            uid = h['user_id']
            if uid not in user_hotels_map:
                user_hotels_map[uid] = []
            user_hotels_map[uid].append(h)

        for user in active_due:
            try:
                user_id = user['id']
                s_logger.info(f"Processing user {user_id}...")

                # 2. Update next_scan_at immediately (Locking mechanism)
                # KAİZEN: Precise Scheduling (Anti-Drift)
                # We calculate the NEXT scan relative to the INTENDED schedule time 
                # instead of now() to prevent the "creeping drift" problem where 
                # delays accumulate day over day.
                freq = settings_map.get(user_id) or user.get("scan_frequency_minutes") or 1440
                intended_at_str = user.get("next_scan_at")
                
                if intended_at_str:
                    try:
                        intended_at = datetime.fromisoformat(intended_at_str.replace("Z", "+00:00"))
                        next_run_dt = intended_at + timedelta(minutes=freq)
                        # Guard: If we are catastrophically behind (e.g. system was down for days), 
                        # don't schedule 1000 scans in the past. Re-anchor to now.
                        if next_run_dt < now_dt:
                            next_run_dt = now_dt + timedelta(minutes=freq)
                    except Exception:
                        next_run_dt = now_dt + timedelta(minutes=freq)
                else:
                    next_run_dt = now_dt + timedelta(minutes=freq)
                
                next_run_iso = next_run_dt.isoformat().replace("+00:00", "Z")
                
                supabase.table("profiles").update({"next_scan_at": next_run_iso}).eq("id", user_id).execute()
                s_logger.info(f"User {user_id}: Updated next_scan_at to {next_run_iso} (intended was {intended_at_str})")
                
                # 3. Execute scan DIRECTLY (self-sufficient — no external worker needed)
                # EXPLANATION: Previous architecture dispatched to Celery/Redis, requiring
                # a separate VM worker to be alive. If the worker was down, scans silently
                # failed. Now we run the scan in-process so GitHub Actions is self-sufficient.
                hotels = user_hotels_map.get(user_id, [])
                if hotels:
                    # Create a scan session for tracking
                    session_id = None
                    try:
                        session_result = supabase.table("scan_sessions").insert({
                            "user_id": user_id,
                            "session_type": "scheduled",
                            "hotels_count": len(hotels),
                            "status": "pending",
                        }).execute()
                        session_id = session_result.data[0]["id"] if session_result.data else None
                    except Exception as se:
                        s_logger.warning(f"Session creation failed for scheduled scan: {se}")
                    
                    # KAİZEN: Direct Execution (eliminates Celery worker dependency)
                    # Run the full scan pipeline in-process instead of dispatching to Redis.
                    # This ensures scans complete even without an external VM worker.
                    try:
                        s_logger.info(f"Executing scan directly for user {user_id} ({len(hotels)} hotels)...")
                        await run_monitor_background(
                            user_id=UUID(user_id),
                            hotels=hotels,
                            options=None,
                            db=supabase,
                            session_id=UUID(session_id) if session_id else None
                        )
                        s_logger.info(f"Direct scan completed for user {user_id} (session={session_id})")
                    except Exception as direct_e:
                        s_logger.error(f"Direct execution failed for {user_id}: {direct_e}")
                        # Fallback: try Celery dispatch if direct execution fails
                        try:
                            from backend.celery_app import celery_app
                            celery_app.send_task("backend.tasks.run_scan_task", kwargs={
                                "user_id": user_id,
                                "hotels": hotels,
                                "options_dict": None,
                                "session_id": str(session_id) if session_id else None
                            })
                            s_logger.info(f"Fallback: Dispatched to Celery for user {user_id}")
                        except Exception as fallback_e:
                            s_logger.error(f"Both direct and Celery dispatch failed for {user_id}: {fallback_e}")
                
            except Exception as u_e:
                s_logger.error(f"Error processing user {user.get('id')}: {u_e}")
                
    except Exception as e:
        s_logger.critical(f"CRON ERROR: {e}")
        s_logger.error(traceback.format_exc())

if __name__ == "__main__":
    # EXPLANATION: CLI Test Mode
    # Allows manual testing of the scheduler logic from the terminal.
    # Usage: export PYTHONPATH=$PYTHONPATH:. && python3 backend/services/monitor_service.py
    import asyncio
    print("Starting manual scheduler check...")
    asyncio.run(run_scheduler_check_logic())
    print("Check complete. See scheduler.log for details.")
