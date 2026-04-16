"""
Monitor Service.
Orchestrates the asynchronous background AI Agent-Mesh for price monitoring.

Architecture Overview:
1. Heartbeat Polling: Every 4 hours, a GitHub Action (or manual trigger) calls 
   'process_system_scans' to find hotels needing a pulse check.
2. Async Batching: Hotels are dispatched to DataForSEO in batches of 100.
3. Task Persistence: Each external DataForSEO task is mapped to an internal 'scan_task' UUID.
4. Results Retrieval: A separate loop in 'process_system_scans' checks for completed
   external tasks and persists results via 'ScanPersistenceService'.
"""

import os
import asyncio
import logging
import traceback
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Set
from uuid import UUID
from fastapi import BackgroundTasks
from supabase import Client
from backend.models.schemas import ScanOptions, MonitorResult, SCAN_PULSE_INTERVAL_MINUTES, SCAN_PULSE_INTERVAL_HOURS
from backend.services.providers.dataforseo_provider import dataforseo_provider
from backend.services.scan_persistence import ScanPersistenceService
from backend.utils.db import get_supabase
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# from backend.agents.scraper_agent import ScraperAgent
# from backend.agents.analyst_agent import AnalystAgent
# from backend.agents.notifier_agent import NotifierAgent


# Dedicated Scheduler Logging
def get_scheduler_logger():
    s_logger = logging.getLogger("scheduler")
    if not s_logger.handlers:
        from logging.handlers import RotatingFileHandler

        # Environment-Aware Log Path
        # This prevents crashes when the scheduler runs outside the VM.
        vm_path = "/home/tripzydevops/hotel/scheduler.log"
        local_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "scheduler.log")
        )

        log_path = (
            vm_path
            if os.path.isfile(vm_path) or os.path.isdir(os.path.dirname(vm_path))
            else local_path
        )

        try:
            handler = RotatingFileHandler(
                log_path, maxBytes=5 * 1024 * 1024, backupCount=3
            )
        except (OSError, PermissionError):
            # Final fallback: stream to stdout (visible in GitHub Actions logs)
            handler = logging.StreamHandler()

        formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")
        handler.setFormatter(formatter)
        s_logger.addHandler(handler)
        s_logger.setLevel(logging.INFO)
        s_logger.propagate = False
    return s_logger


async def record_system_pulse(
    db: Client,
    action_type: str,
    status: str = "success",
    status_detail: Optional[str] = None
):
    """
    Logs a system event (pulse or mesh activity) to query_logs for feed visibility.
    """
    try:
        res = db.table("query_logs").insert({
            "user_id": None, # System records have no owner
            "action_type": action_type,
            "status": status,
            "status_detail": status_detail,
            "hotel_name": "System Mesh" if action_type == "mesh_activity" else "Antigravity OS",
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        # KAİZEN: Handle silent Failures
        # postgrest-py execute() returns an object that might have 'error' populated
        # but doesn't necessarily raise an exception.
        if hasattr(res, "error") and res.error:
            logger.error(f"Pulse recording failed (PostgREST Error): {res.error}")
        elif not res.data:
            logger.warning(f"Pulse recording returned no data for {action_type}")
            
    except Exception as e:
        logger.error(f"Pulse recording exception: {e}", exc_info=True)


async def trigger_monitor_logic(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    options: Optional[ScanOptions],
    db: Client,
    current_user_id: str,
    current_user_email: Optional[str],
) -> MonitorResult:
    """
    Main trigger for price monitoring.
    Enforces limits, normalizes dates, and launches the background orchestrator.

    Reminder Note: Standard users are limited to daily manual scan quotas.
    Enterprise users have unlimited background agent cycles.
    """

    # Reach hotels via user_hotels table for Multi-User/Many-to-Many compatibility
    hotel_mappings_query = (
        db.table("user_hotels")
        .select("hotel_id, is_target, pricing_dna, preferred_currency, fixed_check_in, fixed_check_out, default_adults, hotels(*)")
        .eq("user_id", str(user_id))
    )
    
    # Filter by specific hotel IDs if provided in options
    if options and options.hotel_ids:
        hotel_id_strs = [str(hid) for hid in options.hotel_ids]
        hotel_id_strs = [str(hid) for hid in options.hotel_ids]
        hotel_mappings_query = hotel_mappings_query.in_("hotel_id", hotel_id_strs)
        
    mappings_res = hotel_mappings_query.execute()
    
    hotels = []
    for mapping in (mappings_res.data or []):
        if mapping.get("hotels"):
            h_data = mapping["hotels"]
            # Filter soft-deleted hotels
            if h_data.get("deleted_at"):
                continue
            # Override specialized settings from user_hotels association
            h_data["is_target_hotel"] = mapping.get("is_target", False)
            h_data["pricing_dna"] = mapping.get("pricing_dna")
            h_data["preferred_currency"] = mapping.get("preferred_currency", "USD")
            h_data["fixed_check_in"] = mapping.get("fixed_check_in")
            h_data["fixed_check_out"] = mapping.get("fixed_check_out")
            h_data["default_adults"] = mapping.get("default_adults", 2)
            
            hotels.append(h_data)

    if not hotels:
        return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0)

    # 1. ADMIN BYPASS / LIMIT ENFORCEMENT
    try:
        is_admin = False
        profile_res = (
            db.table("user_profiles")
            .select("role")
            .eq("user_id", str(current_user_id))
            .execute()
        )
        if profile_res.data and profile_res.data[0].get("role") in [
            "admin",
            "market_admin",
            "market admin",
        ]:
            is_admin = True

        if not is_admin:
            # FIX: Use SubscriptionService (not legacy tier_configs) to check limits.
            # tier_configs is a separate table that may not have trial entries.
            # SubscriptionService uses DEFAULT_TIERS as fallback (correctly configured
            # for trial users to have enterprise-level access).
            from backend.services.subscription import SubscriptionService

            full_profile_res = (
                db.table("profiles")
                .select("plan_type, subscription_status, current_period_end")
                .eq("id", str(user_id))
                .execute()
            )
            profile_data = full_profile_res.data[0] if full_profile_res.data else {}
            access = await SubscriptionService.get_user_limits(db, profile_data)

            if access.get("state") == "locked":
                reason = access.get("reason", "No Active Subscription")
                logger.warning(f"Manual scan blocked for {user_id}: {reason}")
                
                # Log lock to session trace if possible
                # Note: session_id is not yet defined in this scope

                return MonitorResult(
                    hotels_checked=0,
                    prices_updated=0,
                    alerts_generated=0,
                    errors=[f"SCAN_LOCKED: {reason}"],
                )

            # Unified Daily Manual Scan Limits
            # Enforces specific daily quotas:
            # Trial (3), Starter (5), Pro (8), Enterprise (10)
            limits = access.get("limits", {})
            daily_limit = limits.get("monthly_scan_limit", 3)  # Using column as daily quota
            
            today_start = datetime.combine(
                date.today(), datetime.min.time()
            ).isoformat()
            
            daily_manual_res = (
                db.table("scan_sessions")
                .select("id", count="exact")
                .eq("user_id", str(user_id))
                .eq("session_type", "manual")
                .gte("created_at", today_start)
                .execute()
            )
            current_daily_count = daily_manual_res.count or 0
            
            if current_daily_count >= daily_limit:
                logger.warning(f"Manual scan limit reached for {user_id}: {current_daily_count}/{daily_limit}")
                return MonitorResult(
                    hotels_checked=0,
                    prices_updated=0,
                    alerts_generated=0,
                    errors=[f"DAILY_LIMIT_REACHED ({daily_limit})"],
                )

    except Exception as e:
        logger.error(f"Limit check exception: {e}")

    # 2. Stay Metadata Logic
    check_in = options.check_in if options and options.check_in else None
    check_out = options.check_out if options and options.check_out else None
    today = date.today()
    
    if (not check_in) or (str(check_in) == str(today)):
        # Late night advances for Google Travel reliability
        if datetime.now().hour >= 18:
            check_in = today + timedelta(days=1)
            # Trace will be logged after session_id is available

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
        session_result = (
            db.table("scan_sessions")
            .insert(
                {
                    "user_id": str(user_id),
                    "session_type": "manual",
                    "hotels_count": len(hotels),
                    "status": "pending",
                    "check_in_date": str(check_in),
                    "check_out_date": str(check_out),
                    "adults": adults,
                    "currency": currency,
                }
            )
            .execute()
        )
        if session_result.data:
            session_id = session_result.data[0]["id"]
            logger.info(f"Created scan session: {session_id}")
            
            # Post-creation reasoning trace for the 18:00 cutoff
            if (not options or not options.check_in or str(options.check_in) == str(date.today())) and datetime.now().hour >= 18:
                try:
                    db.table("scan_sessions").update({
                        "reasoning_trace": [{"step": "Monitor", "level": "info", "message": "Advanced check-in to tomorrow due to 18:00 cutoff for Google Travel reliability.", "timestamp": datetime.now().timestamp()}]
                    }).eq("id", str(session_id)).execute()
                except (Exception) as e:
                    logger.debug(f"Failed to update reasoning trace cutoff: {str(e)}")
        else:
            logger.error("Session creation returned no data. Scan will run without history trail.")
    except (Exception) as e:
        logger.error(f"CRITICAL: Session creation failed: {str(e)}. Attempting to proceed with silent scan.")

    # Normalized Options for Background task
    normalized_options = ScanOptions(
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        currency=currency,
        hotel_ids=options.hotel_ids if options else None,
        skip_intelligence=options.skip_intelligence if options else False,
    )

    # Sync Scheduler (Anti-Drift)
    # When a user triggers a manual scan, we advance their 'next_scan_at' 
    # to avoid a scheduled scan triggering immediately after.
    try:
        freq = SCAN_PULSE_INTERVAL_MINUTES # Standard 4-hour system pulse
        new_next = (datetime.now(timezone.utc) + timedelta(minutes=freq)).isoformat().replace("+00:00", "Z")
        db.table("profiles").update({"next_scan_at": new_next}).eq("id", str(user_id)).execute()
        logger.info(f"Manual scan: Advanced next_scan_at for {user_id} to {new_next}")
    except Exception as sync_e:
        logger.warning(f"Failed to sync next_scan_at during manual trigger: {sync_e}")

    # 4. Background Execution (Direct via BackgroundTasks)
    # Lean Serverless Execution
    # Redis/Celery dependency has been removed.
    # We now exclusively use FastAPI's BackgroundTasks for in-process execution.
    try:
        if background_tasks is not None:
            trace_msg = "Executing scan directly via BackgroundTasks"
            logger.info(trace_msg)

            if session_id:
                try:
                    db.table("scan_sessions").update(
                        {"reasoning_trace": [trace_msg]}
                    ).eq("id", str(session_id)).execute()
                except (Exception) as trace_update_e:
                    logger.debug(f"Could not update reasoning trace: {str(trace_update_e)}")

            # Lazy import
            from backend.services.monitor_service import run_monitor_background

            background_tasks.add_task(
                run_monitor_background,
                user_id=user_id,
                hotels=hotels,
                options=normalized_options,
                db=db,
                session_id=UUID(session_id) if session_id else None,
            )
            logger.info(f"Background scan started for session {session_id}")
        else:
            logger.error(
                "BackgroundTasks unavailable. Scan cannot be started in-process."
            )
    except Exception as e:
        logger.error(f"Background execution failed: {e}")

    return MonitorResult(
        hotels_checked=len(hotels),
        prices_updated=0,
        alerts_generated=0,
        session_id=UUID(session_id) if session_id else None,
        errors=[],
    )


async def run_monitor_background(
    user_id: UUID,
    hotels: List[Dict[str, Any]],
    options: Optional[ScanOptions],
    db: Client,
    session_id: Optional[UUID],
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

        # 2. Get User Settings (M2M context)
        threshold = 2.0
        settings = {}
        try:
            # Ensure we fetch settings specifically for this user context
            settings_res = (
                db.table("settings")
                .select("*")
                .eq("user_id", str(user_id))
                .execute()
            )
            if settings_res.data:
                settings = settings_res.data[0]
                threshold = settings.get("threshold_percent", 2.0)
        except Exception as e:
            logger.debug(f"Failed to fetch user settings: {e}")

        # 3. Phase 1: Scraper Agent
        logger.info(f"Starting ScraperAgent for {len(hotels)} hotels...")
        scraper_results = await scraper.run_scan(user_id, hotels, options, session_id)

        # 4. Phase 2: Analyst Agent (Persistence Phase)
        logger.info("Starting AnalystAgent Persistence...")
        analysis_summary = await analyst.persist_results_only(
            user_id, scraper_results, threshold, settings=settings, options=options, session_id=session_id
        )

        # 4.5 Room Type Cataloging (Quick)
        try:
            # Shift to the new unified batch persistence in the analyst's persistence handle
            await analyst.persistence.batch_update_room_type_catalog(scraper_results, hotels)
        except Exception as e:
            logger.warning(f"Room Catalog failure: {e}")

        # 5. Determine status and trigger AI Phase (Non-blocking)
        final_status = "completed"
        if any(res.get("status") != "success" for res in scraper_results):
            final_status = "partial"
        
        if options and options.skip_intelligence:
            if session_id:
                db.table("scan_sessions").update({
                    "status": final_status, 
                    "completed_at": datetime.now().isoformat()
                }).eq("id", str(session_id)).execute()
        else:
            # Shift to Intelligence Pending so user sees results but knows AI is working
            if session_id:
                db.table("scan_sessions").update({
                    "status": "intelligence_pending",
                    "updated_at": datetime.now().isoformat()
                }).eq("id", str(session_id)).execute()
            
            # Launch AI phase (Background task within the background task)
            # We use create_task to allow the main orchestrator to "finish"
            # basic reporting/alerts while AI chews on the data.
            async def intel_task_wrapper():
                try:
                    await analyst.run_intelligence_only(
                        user_id, scraper_results, analysis_summary, threshold, options, session_id
                    )
                    # Once AI finishes, we set the true final status
                    if session_id:
                        db.table("scan_sessions").update({
                            "status": final_status,
                            "completed_at": datetime.now().isoformat()
                        }).eq("id", str(session_id)).execute()
                except Exception as intel_e:
                    logger.error(f"Intelligence Task Crash: {intel_e}")
                    if session_id:
                        db.table("scan_sessions").update({"status": final_status}).eq("id", str(session_id)).execute()

            asyncio.create_task(intel_task_wrapper())

        # 5. Phase 3: Notifier Agent
        if analysis_summary.get("alerts"):
            try:
                # Re-fetch settings if not available from earlier phase
                if not settings:
                    settings_res = (
                        db.table("settings")
                        .select("*")
                        .eq("user_id", str(user_id))
                        .execute()
                    )
                    settings = settings_res.data[0] if settings_res.data else None
                if settings:
                    hotel_name_map = {h["id"]: h["name"] for h in hotels}
                    await notifier.dispatch_alerts(
                        analysis_summary["alerts"], settings, hotel_name_map
                    )
            except Exception as e:
                logger.warning(f"Notifier failure: {e}")

        # 6. Finalize Session moved to Phase 5 status-aware logic to support background AI

        # Final Sync Safety
        # Ensure next_scan_at is pushed forward if this was a manual scan that 
        # somehow missed the trigger update, or a scheduled scan that finished.
        try:
            profile_res = db.table("profiles").select("next_scan_at").eq("id", str(user_id)).execute()
            
            if profile_res.data:
                prof = profile_res.data[0]
                nxt = prof.get("next_scan_at")
                
                now_utc = datetime.now(timezone.utc)
                is_due = True
                if nxt:
                    try:
                        nxt_dt = datetime.fromisoformat(nxt.replace("Z", "+00:00"))
                        if nxt_dt > now_utc:
                            is_due = False
                    except (Exception):
                        is_due = True
                
                if is_due:
                    freq = 240 # Unified 4-hour heartbeat
                    new_nxt = (now_utc + timedelta(minutes=freq)).isoformat().replace("+00:00", "Z")
                    db.table("profiles").upsert({
                        "id": str(user_id),
                        "next_scan_at": new_nxt
                    }).execute()
                    logger.info(f"Background: Force-advanced next_scan_at for {user_id} to {new_nxt}")

            # Record Mesh Activity for visible feed update
            await record_system_pulse(db, "mesh_activity")
        except Exception as fe:
            logger.warning(f"Background: Final sync safety failed: {fe}")

    except Exception as e:
        logger.critical(f"SYSTEM FAILURE: {e}")
        traceback.print_exc()
        if session_id:
            try:
                # Capture Error in reasoning trace
                res = (
                    db.table("scan_sessions")
                    .select("reasoning_trace")
                    .eq("id", str(session_id))
                    .execute()
                )
                trace = res.data[0].get("reasoning_trace") or [] if res.data else []
                trace.append(f"[SYSTEM FAILURE] {str(e)}")

                db.table("scan_sessions").update(
                    {
                        "status": "failed",
                        "reasoning_trace": trace,
                        "completed_at": datetime.now().isoformat(),
                    }
                ).eq("id", str(session_id)).execute()
            except Exception as e:
                logger.error(f"Failed to record system failure in session trace: {e}")


async def run_scheduler_check_logic():
    """
    [CRITICAL BACKGROUND LOGIC]
    Core engine for the persistent background scheduler.

    FEATURE OVERVIEW:
    - Resolves 'Lazy Cron' by running independently of frontend traffic.
    - Uses a multi-layered trigger (VM Cron + GitHub Actions).
    - Ensures scans are dispatched to Celery workers for asynchronous processing.

    FLOW:
    1. Triggers the System Heartbeat which checks the global pulse (default: 4h).
    2. Orchestrates DataForSEO result collection and processing.
    3. Cleans up any stalled or zombie scan sessions.
    """
    s_logger = get_scheduler_logger()
    s_logger.info("CRON: Starting scheduler check...")
    from backend.utils.db import get_supabase

    try:
        supabase = get_supabase(admin=True)
        if not supabase:
            logger.error("CRON: Database unavailable")
            return

        # 1. RUN SYSTEM PULSE (5-minute heartbeat for UI 'Alive' feeling)
        try:
            five_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
            recent_pulse = (
                supabase.table("query_logs")
                .select("id")
                .eq("action_type", "system_pulse")
                .gt("created_at", five_mins_ago)
                .limit(1)
                .execute()
            )
            if not recent_pulse.data:
                await record_system_pulse(supabase, "system_pulse")
                s_logger.info("CRON: Emitted system heartbeat pulse.")
        except Exception as p_e:
            s_logger.debug(f"Pulse emission skipped: {p_e}")

        # 1.1 INITIALIZE STALE PROFILES (Self-Healing)
        # Ensure any user with monitored hotels has a next_scan_at assigned.
        # This prevents new users or manually cleared profiles from being 'stuck'.
        try:
            stale_profiles = supabase.table("profiles")\
                .select("id")\
                .is_("next_scan_at", "null")\
                .execute()
            
            if stale_profiles.data:
                for p in stale_profiles.data:
                    # Only assign if they actually have monitored hotels
                    h_count = supabase.table("user_hotels")\
                        .select("id", count="exact")\
                        .eq("user_id", p["id"])\
                        .eq("is_monitored", True)\
                        .execute()
                    
                    if h_count.count and h_count.count > 0:
                        initial_nxt = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
                        supabase.table("profiles").update({"next_scan_at": initial_nxt}).eq("id", p["id"]).execute()
                        s_logger.info(f"CRON: Initialized next_scan_at for user {p['id']}")
        except Exception as sh_e:
            s_logger.warning(f"CRON: Self-healing failed: {sh_e}")

        # 1.5 RUN SYSTEM HEARTBEAT (New Global 4h Standard)
        # This function handles its own timing checks via admin_settings table.
        await run_system_heartbeat(supabase)
        
        # 2. PROCESS COMPLETED TASKS (DataForSEO result collector)
        await process_system_scans(supabase)

        # 3. Cleanup Zombie Sessions and Tasks
        try:
            # 3.1. Cleanup sessions (2-hour cutoff)
            zombie_cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=2)
            ).isoformat()
            zombies = (
                supabase.table("scan_sessions")
                .select("id")
                .in_("status", ["pending", "running", "processing"])
                .lt("created_at", zombie_cutoff)
                .execute()
            )

            if zombies.data:
                z_ids = [z["id"] for z in zombies.data]
                s_logger.warning(
                    f"CRON: Cleaning up {len(z_ids)} zombie sessions: {z_ids}"
                )
                supabase.table("scan_sessions").update(
                    {"status": "failed", "completed_at": datetime.now().isoformat()}
                ).in_("id", z_ids).execute()

            # 3.2. Cleanup stale scan_tasks (12-hour cutoff)
            task_stale_cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=12)
            ).isoformat()
            stale_tasks = (
                supabase.table("scan_tasks")
                .select("id, batch_id")
                .eq("status", "pending")
                .lt("created_at", task_stale_cutoff)
                .execute()
            )

            if stale_tasks.data:
                st_ids = [tk["id"] for tk in stale_tasks.data]
                s_logger.warning(
                    f"CRON: Cleaning up {len(st_ids)} stale scan_tasks (abandoned): {st_ids}"
                )
                supabase.table("scan_tasks").update(
                    {"status": "failed", "error_message": "Abandoned: No response from provider after 12h"}
                ).in_("id", st_ids).execute()
                
                # Also increment failure count for their batches
                batch_ids = list(set([tk["batch_id"] for tk in stale_tasks.data if tk.get("batch_id")]))
                for b_id in batch_ids:
                    supabase.rpc("increment_batch_failures", {"b_id": b_id}).execute()
        except (Exception) as z_e:
            s_logger.error(f"CRON: Stale cleanup failed: {str(z_e)}")

        # 4. DAILY MARKET SYNC (Eyes of Turkey)
        # Maintained once per 24 hours for regional intelligence.
        try:
            today_date = date.today().isoformat()
            last_sync = (
                supabase.table("scan_sessions")
                .select("id")
                .eq("session_type", "market_sync")
                .gte("created_at", f"{today_date}T00:00:00Z")
                .limit(1)
                .execute()
            )

            if not last_sync.data:
                s_logger.info("CRON: Triggering global market intelligence sync (Eyes of Turkey)...")
                
                sync_session = supabase.table("scan_sessions").insert({
                    "user_id": None,
                    "session_type": "market_sync",
                    "status": "running",
                    "hotels_count": 0
                }).execute()
                
                sync_id = sync_session.data[0]["id"] if sync_session.data else None
                
                from backend.services.market.tobb_scraper import TOBBScraper
                from backend.services.market.tga_scraper import TGAScraper
                
                tobb = TOBBScraper(supabase)
                tga = TGAScraper(supabase)
                
                tobb_res = await tobb.scrape_to_supabase()
                tga_res = await tga.scrape_to_supabase()
                
                status = "completed" if (tobb_res.get("status") == "success" and tga_res.get("status") == "success") else "partial"
                
                if sync_id:
                    supabase.table("scan_sessions").update({
                        "status": status,
                        "completed_at": datetime.now().isoformat(),
                        "reasoning_trace": [f"TOBB: {tobb_res}", f"TGA: {tga_res}"]
                    }).eq("id", sync_id).execute()
                
                s_logger.info(f"CRON: Market sync complete. Status: {status}")
            else:
                s_logger.info("CRON: Market sync already completed for today.")
        except (Exception) as m_e:
            s_logger.error(f"CRON: Market sync failed: {str(m_e)}")

        s_logger.info("CRON: Global system cycle check complete.")

    except Exception as e:
        s_logger.critical(f"CRON ERROR: {e}")
        s_logger.error(traceback.format_exc())


async def run_system_heartbeat(db: Client):
    """
    Checks if a global system-wide hotel scan is due.
    If due, submits all unique monitored hotels to the DataForSEO Task API.
    """
    s_logger = get_scheduler_logger()
    try:
        # 1. Fetch Admin Settings
        settings_res = db.table("admin_settings").select("*").limit(1).execute()
        if not settings_res.data:
            s_logger.warning("Heartbeat: No admin settings found. Skipping.")
            return

        settings = settings_res.data[0]
        # Transitioning to new 4 hour system-wide standard
        interval = SCAN_PULSE_INTERVAL_HOURS
        last_scan = settings.get("last_global_scan_at")
        
        now = datetime.now(timezone.utc)
        
        # 2. Check overlap
        is_due = True
        if last_scan:
            try:
                last_dt = datetime.fromisoformat(last_scan.replace("Z", "+00:00"))
                if (now - last_dt).total_seconds() < (interval * 3600):
                    is_due = False
            except Exception:
                is_due = True
        
        if not is_due and not getattr(db, "_force_heartbeat", False):
            # next_scan_at usually set by the updater, but check if we should update UI info
            return

        s_logger.info(f"Heartbeat: Global system scan starting (Interval: {interval}h)...")

        # 3. Fetch all unique monitored hotels
        # 1. Update Admin Settings immediately (Optimistic Locking)
        # This prevents the 5-minute scheduler loop from retrying if this execution is slow.
        next_scan = now + timedelta(hours=interval)
        try:
            db.table("admin_settings").update({
                "last_global_scan_at": now.isoformat(),
                "next_global_scan_at": next_scan.isoformat()
            }).eq("id", settings["id"]).execute()
        except Exception as e:
            s_logger.warning(f"Heartbeat: Failed to update admin settings timestamp (pre-submission): {e}")

        # 2. Get monitored hotels
        monitored_res = (
            db.table("user_hotels")
            .select("hotel_id, hotels(name, location, property_token, serp_api_id)")
            .eq("is_monitored", True)
            .execute()
        )
        if not monitored_res.data:
            s_logger.info("Scheduler: No monitored hotels found.")
            return

        # Deduplicate by Unique Token (property_token) to save credits
        criteria_groups = {} # token -> [list_of_ids]
        criteria_data = {}   # token -> hotel_metadata
        
        for item in monitored_res.data:
            h = item.get("hotels")
            if not h: continue
            
            # Use serp_api_id as the primary unique key, then property_token
            token = h.get("serp_api_id")
            if not token:
                token = h.get("property_token")
            
            if not token:
                # Fallback to name/location only if both identifiers are missing
                token = f"{h['name'].lower().strip()}|{h['location'].lower().strip()}"
            
            if token not in criteria_groups:
                criteria_groups[token] = []
                criteria_data[token] = h
            criteria_groups[token].append(item["hotel_id"])

        if not criteria_groups:
            s_logger.info("Heartbeat: No valid monitored hotels found after deduplication.")
            return

        s_logger.info(f"Heartbeat: Submitting {len(criteria_groups)} unique search tasks (from {len(monitored_res.data)} monitored records)...")
        
        # 4. Use the optimized batch submission logic
        target_hotel_ids = [h_ids[0] for h_ids in criteria_groups.values()]
        
        check_in = date.today().strftime("%Y-%m-%d")
        check_out = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        success_count = await dataforseo_provider.submit_hotel_scan_batch(
            db=db,
            hotel_ids=target_hotel_ids,
            check_in=check_in,
            check_out=check_out,
            batch_type="scheduled_pulse",
            deep_scan=True
        )

        s_logger.info(f"Heartbeat: Successfully posted {success_count}/{len(target_hotel_ids)} tracking units.")
        
        # 5. [VECTORIZED] Trigger high-speed processing of any ready tasks
        await process_system_scans(db)

    except Exception as e:
        s_logger.error(f"Heartbeat Failure: {e}")


async def process_system_scans(db: Client):
    """
    The System Heartbeat Processor. Optimized for Batch Syncing.
    """
    s_logger = get_scheduler_logger()
    try:
        # 1. Get completed task IDs
        completed_ids = await dataforseo_provider.get_completed_tasks()
        if not completed_ids:
            return

        s_logger.info(f"Task Processor: Found {len(completed_ids)} completed scanning tasks.")
        
        # 2. Extract Task IDs and resolve Metadata in BULK
        task_id_to_metadata = {} # tag -> {hotel_id, batch_id}
        tags_to_resolve = []
        for tid in completed_ids:
            # We assume tag is the scan_task_id (UUID)
            tags_to_resolve.append(tid)

        if tags_to_resolve:
            # We search for either our internal ID or the provider's task ID
            tags_quoted = [f'"{t}"' for t in tags_to_resolve]
            tasks_res = db.table("scan_tasks")\
                .select("id, external_task_id, hotel_id, batch_id")\
                .or_(f"id.in.({','.join(tags_quoted)}),external_task_id.in.({','.join(tags_quoted)})")\
                .execute()
            
            for t in (tasks_res.data or []):
                # Map by both IDs to ensure resolution
                task_id_to_metadata[t["id"]] = t
                if t.get("external_task_id"):
                    task_id_to_metadata[t["external_task_id"]] = t

        # Collector Buffer for Batch Processing
        batch_results = [] # List of {hotel_id, result, scan_task_id, batch_id}
        
        # Parallel fetch for all completed tasks from DataForSEO
        # polymorphic get_task_result handles both hotel_searches and hotel_info
        fetch_tasks = [dataforseo_provider.get_task_result(tid) for tid in completed_ids]
        all_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

        for i, result in enumerate(all_results):
            tid = completed_ids[i]
            if isinstance(result, Exception):
                s_logger.error(f"Task Processor: Error fetching task {tid}: {result}")
                continue
                
            if not result or result.get("status") != "success":
                continue

            tag_raw = result.get("tag", tid) # Fallback to tid if tag missing
            meta = task_id_to_metadata.get(tag_raw)
            
            if not meta:
                # Last resort: if not in metadata map, we can't sync it reliably
                continue

            batch_results.append({
                "hotel_id": meta["hotel_id"],
                "result": result,
                "scan_task_id": meta["id"],
                "batch_id": meta.get("batch_id")
            })

        if batch_results:
            s_logger.info(f"Task Processor: Syncing {len(batch_results)} results in vectorized batch...")
            success = await sync_extraction_results_batch(db, batch_results)
            if success:
                s_logger.info(f"Task Processor: Successfully synced {len(batch_results)} results.")
            else:
                s_logger.error("Task Processor: Batch sync failed.")

    except Exception as e:
        s_logger.error(f"Task Processor General Failure: {e}")


async def _trigger_heartbeat_notifications(db: Client, hotel_id: str, current_price: float, currency: str, initiator_id: Optional[UUID] = None):
    """
    Finds all users monitoring this hotel and triggers alerts if price drops/changes.
    If initiator_id is provided, those alerts are marked as 'market_pulse' for others.
    """
    try:
        from backend.agents.notifier_agent import NotifierAgent
        notifier = NotifierAgent()

        # 1. Find all users who monitor this hotel
        query = db.table("user_hotels").select("user_id, hotel_id, hotels(name, property_token)").eq("hotel_id", hotel_id).eq("is_monitored", True)
        users_res = query.execute()
        if not users_res.data:
            return

        hotel_data = users_res.data[0].get("hotels", {})
        hotel_name = hotel_data.get("name", "Unknown Hotel")

        # 2. For each user, check their individual threshold
        user_ids = [u["user_id"] for u in users_res.data]
        settings_res = db.table("settings").select("*").in_("user_id", user_ids).execute()
        settings_map = {str(s["user_id"]): s for s in settings_res.data}

        for user_id_str in user_ids:
            user_id = UUID(user_id_str)
            settings = settings_map.get(user_id_str)
            if not settings or not settings.get("notifications_enabled"):
                continue

            # Skip initiator if strictly heartbeat-only (not used for manual triggers)
            # Actually, we want manual triggers to notify the initiator TOO, but system heartbeats notify everyone.
            
            threshold = settings.get("threshold_percent", 2.0)
            
            # Fetch last baseline from history (index 1 is previous, index 0 is current)
            # Get price history for threshold comparison
            history_res = db.table("price_logs")\
                .select("price")\
                .eq("hotel_id", hotel_id)\
                .order("recorded_at", desc=True)\
                .limit(2)\
                .execute()
            
            if len(history_res.data) < 2:
                continue
            
            prev_price = float(history_res.data[1]["price"])
            change_pct = ((current_price - prev_price) / max(prev_price, 1)) * 100

            if abs(change_pct) >= threshold:
                # If triggered by someone else, it's a pulse. If global, it's a heartbeat/drop.
                is_manual_initiator = initiator_id and str(initiator_id) == user_id_str
                
                if initiator_id and not is_manual_initiator:
                    alert_type = "market_pulse"
                    prefix = "Global Pulse: "
                else:
                    alert_type = "price_drop" if change_pct < 0 else "price_spike"
                    prefix = ""

                alert_msg = f"{prefix}{hotel_name} rate shifted {abs(change_pct):.1f}% to {current_price} {currency}"
                
                # Record alert
                alert_res = db.table("alerts").insert({
                    "user_id": str(user_id),
                    "hotel_id": hotel_id,
                    "alert_type": alert_type,
                    "message": alert_msg,
                    "old_price": prev_price,
                    "new_price": current_price,
                    "currency": currency
                }).execute()

                # Dispatch notification
                if alert_res.data:
                    await notifier.dispatch_alerts([alert_res.data[0]], settings, {hotel_id: hotel_name})

    except Exception as e:
        logger.error(f"Heartbeat Notifier Error for hotel {hotel_id}: {e}")


async def sync_extraction_result(db: Client, hotel_id: str, result: Dict[str, Any], scan_task_id: Optional[str] = None, batch_id: Optional[str] = None, source: str = "System"):
    """
    Unified logic to update a hotel and its variations with a new extraction result.
    Updates prices, logs history, triggers notifications, and increments batch status.
    """
    from backend.utils.logger import get_logger
    logger = get_logger(__name__)
    
    try:
        # 1. Validation
        try:
            from uuid import UUID
            UUID(hotel_id)
        except ValueError:
            logger.warning(f"Sync: Invalid hotel UUID: {hotel_id}")
            return False

        price = result.get("price")
        currency = result.get("currency", "TRY")
        
        if not price or float(price) <= 0:
            if scan_task_id:
                db.table("scan_tasks").update({"status": "failed", "error_message": "Invalid price"}).eq("id", scan_task_id).execute()
                if batch_id: db.rpc("increment_batch_failures", {"b_id": batch_id}).execute()
            return False

        # 2. Get hotel variation context
        primary_res = db.table("hotels").select("id, name, location, property_token").eq("id", hotel_id).single().execute()
        if not primary_res.data:
            logger.warning(f"Sync: Hotel {hotel_id} not found.")
            return False
            
        hotel_ref = primary_res.data
        prop_token = hotel_ref.get("property_token")
        h_name = hotel_ref["name"]
        h_location = hotel_ref["location"]

        # 3. Find variations sharing the same identity
        if prop_token:
            matching_hotels = db.table("hotels").select("id").eq("property_token", prop_token).execute()
        else:
            matching_hotels = db.table("hotels").select("id").eq("name", h_name).eq("location", h_location).execute()
        
        target_ids = [h["id"] for h in matching_hotels.data] if matching_hotels.data else [hotel_id]

        # 4. Use ScanPersistenceService for "Whole Package" persistence
        from backend.services.scan_persistence import ScanPersistenceService
        from backend.utils.db import get_supabase
        persistence = ScanPersistenceService(db, admin_db=get_supabase(admin=True))
        
        for target_id in target_ids:
            # This call now handles: Price Logs (Parity/Market), Hotel Metadata, Sentiment History, and Room Catalog
            await persistence.sync_from_external_provider(
                db=db,
                hotel_id=target_id,
                result=result,
                scan_task_id=scan_task_id,
                batch_id=batch_id,
                source=source
            )
            
            # 5. Trigger Notifications (Heartbeat)
            await _trigger_heartbeat_notifications(db, target_id, float(price), currency)

        # 7. Update Task/Batch status
        if scan_task_id:
            db.table("scan_tasks").update({"status": "completed"}).eq("id", scan_task_id).execute()
            if batch_id: db.rpc("increment_batch_success", {"b_id": batch_id}).execute()
            
        return True

    except Exception as e:
        logger.error(f"Sync Failure: {e}")
        if scan_task_id:
            try:
                db.table("scan_tasks").update({"status": "failed", "error_message": str(e)}).eq("id", scan_task_id).execute()
                if batch_id: db.rpc("increment_batch_failures", {"b_id": batch_id}).execute()
            except: pass
        return False


async def sync_extraction_results_batch(db: Client, batch_items: List[Dict[str, Any]]):
    """
    High-Performance Batch Sync. 
    Processes multiple extraction results in minimal database roundtrips.
    """
    from backend.utils.logger import get_logger
    logger = get_logger(__name__)
    
    if not batch_items:
        return True

    try:
        # 1. Collect all Hotel IDs and validate
        h_ids = []
        hotel_updates = []
        price_logs = []
        sentiment_history = []
        now_ts = datetime.now(timezone.utc).isoformat()
        
        # AGGREGATOR: Group results by hotel_id and MERGE them
        # This handles when both pricing and info tasks return in the same batch
        hotel_data_map = {} # hotel_id -> {merged_result, task_ids[]}
        raw_archives = [] # List of {id, raw_results} for bulk update
        completed_task_ids = [item["scan_task_id"] for item in batch_items if item.get("scan_task_id")]

        for item in batch_items:
            hid = str(item["hotel_id"])
            h_ids.append(hid)
            
            res = item.get("result", {})
            if not res or res.get("status") != "success":
                continue

            # Store Raw JSON for archival
            if item.get("scan_task_id") and res.get("raw_data"):
                raw_archives.append({
                    "id": item["scan_task_id"],
                    "raw_results": res["raw_data"]
                })

            if hid not in hotel_data_map:
                hotel_data_map[hid] = {
                    "res": res,
                    "task_ids": [item.get("scan_task_id")]
                }
            else:
                # Merge logic: favor non-empty lists/dicts
                existing = hotel_data_map[hid]["res"]
                merged = existing.copy()
                for key, val in res.items():
                    # Allow 0 for numeric fields (price), otherwise favor non-empty
                    is_valid_zero = (key == "price" and val == 0)
                    if (val or is_valid_zero) and (not merged.get(key) or (isinstance(val, list) and len(val) > len(merged.get(key, [])))):
                        merged[key] = val
                
                hotel_data_map[hid]["res"] = merged
                hotel_data_map[hid]["task_ids"].append(item.get("scan_task_id"))

        # 2. Bulk Fetch Hotel Context (Tokens/Metadata)
        hotels_res = db.table("hotels").select("id, name, location, property_token").in_("id", h_ids).execute()
        if not hotels_res.data:
            logger.warning(f"Batch Sync: No hotel records found for IDs {h_ids}")
            return False
        
        logger.info(f"Batch Sync: Found {len(hotels_res.data)} hotels for sync.")
        hotel_lookup = {str(h["id"]): h for h in hotels_res.data}
        tokens = list(set([h["property_token"] for h in hotels_res.data if h.get("property_token")]))
        
        # 3. Find all variations sharing same tokens/names
        variations_res = []
        if tokens:
            v_res = db.table("hotels").select("id, property_token, name, location").in_("property_token", tokens).execute()
            variations_res = v_res.data or []
        
        # 4. Prepare Bulk Updates
        hotel_updates = []
        price_logs = []
        persistence = ScanPersistenceService(db, admin_db=get_supabase(admin=True))
        
        now_ts = datetime.now(timezone.utc).isoformat()
        processed_variations = set()
        
        for hid, h_data in hotel_data_map.items():
            h_ref = hotel_lookup.get(hid)
            if not h_ref: continue
            
            res_data = h_data["res"]
            price = float(res_data.get("price", 0))
            currency = res_data.get("currency", "TRY")
            
            # Identify all targets for this specific result (primary + variations)
            token = h_ref.get("property_token")
            targets = [v for v in variations_res if v.get("property_token") == token] if token else [h_ref]
            
            for target in targets:
                target_id = target["id"]
                if target_id in processed_variations: continue
                processed_variations.add(target_id)

                # 1. Update Core Hotel Record
                upd = {
                    "id": target_id,
                    "current_price": price,
                    "name": target.get("name"),
                    "location": target.get("location"),
                    "last_scanned_at": now_ts
                }

                # Map all available metadata frommerged results
                if res_data.get("rating"): upd["rating"] = res_data.get("rating")
                if res_data.get("stars"): upd["stars"] = res_data.get("stars")
                if res_data.get("reviews"): upd["review_count"] = res_data.get("reviews")
                if res_data.get("reviews_count"): upd["review_count"] = res_data.get("reviews_count")
                if res_data.get("description"): upd["description"] = res_data.get("description")
                if res_data.get("amenities"): upd["amenities"] = res_data.get("amenities")
                if res_data.get("check_in_time"): upd["check_in_time"] = res_data.get("check_in_time")
                if res_data.get("check_out_time"): upd["check_out_time"] = res_data.get("check_out_time")
                if res_data.get("sentiment_breakdown"): upd["sentiment_breakdown"] = res_data.get("sentiment_breakdown")
                if res_data.get("room_types"): upd["room_types"] = res_data.get("room_types")

                hotel_updates.append(upd)

                # Price Log Entry (Always log if we have a successful scan, even if price is 0)
                if price >= 0:
                    price_logs.append({
                        "hotel_id": target_id,
                        "price": price,
                        "currency": currency,
                        "parity_offers": res_data.get("parity_offers") or res_data.get("offers", []),
                        "market_offers": res_data.get("all_prices") or res_data.get("market_offers", []),
                        "room_types": res_data.get("room_types", []),
                        "recorded_at": now_ts,
                        "source": "DataForSEO_Batch"
                    })

                # Sentiment History
                if res_data.get("sentiment_breakdown"):
                    sentiment_history.append({
                        "hotel_id": target_id,
                        "rating": res_data.get("rating"),
                        "review_count": res_data.get("reviews") or res_data.get("reviews_count"),
                        "sentiment_breakdown": res_data.get("sentiment_breakdown"),
                        "recorded_at": now_ts
                    })

        # 5. Execute Bulk DB Operations
        if hotel_updates:
            db.table("hotels").upsert(hotel_updates).execute()
            logger.info(f"Batch Sync: Updated {len(hotel_updates)} hotel records.")

        if price_logs:
            db.table("price_logs").insert(price_logs).execute()
            logger.info(f"Batch Sync: Inserted {len(price_logs)} price history logs.")

        if sentiment_history:
            db.table("sentiment_history").insert(sentiment_history).execute()
            logger.info(f"Batch Sync: Inserted {len(sentiment_history)} sentiment history entries.")

        # 6. Update Task Statuses
        if completed_task_ids:
            # Perform atomic status update
            db.table("scan_tasks").update({"status": "completed"}).in_("id", completed_task_ids).execute()
            
            # Perform bulk archival of raw results
            if raw_archives:
                db.table("scan_tasks").upsert(raw_archives).execute()
                logger.info(f"Batch Sync: Archived {len(raw_archives)} raw result documents.")
            
            # Update batch progress using RPC or fallback
            batch_ids = list(set([item["batch_id"] for item in batch_items if item.get("batch_id")]))
            for bid in batch_ids:
                try:
                    db.rpc("increment_batch_success", {"b_id": bid}).execute()
                except Exception as rpc_err:
                    logger.warning(f"Batch Sync: RPC increment_batch_success failed (might not exist): {rpc_err}")

        # 7. [VECTORIZED] Concurrently trigger room catalog updates and notification checks
        persistence = ScanPersistenceService(db, admin_db=get_supabase(admin=True))
        post_sync_tasks = []
        
        # Prepare Batch Catalog Sync
        scraper_results_for_catalog = []
        for hid, h_data in hotel_data_map.items():
            res_data = h_data["res"]
            rooms = res_data.get("room_types", [])
            if rooms:
                scraper_results_for_catalog.append({
                    "hotel_id": hid,
                    "room_types": rooms
                })
        
        if scraper_results_for_catalog:
            hotels_context = list(hotel_lookup.values())
            # Use high-performance vectorized batch update
            post_sync_tasks.append(persistence.batch_update_room_type_catalog(scraper_results_for_catalog, hotels_context))

        # Individual Notification Checks
        for hid, h_data in hotel_data_map.items():
            h_ref = hotel_lookup.get(hid)
            res_data = h_data["res"]
            if h_ref:
                price = float(res_data.get("price", 0))
                currency = res_data.get("currency", "TRY")
                if price > 0:
                    post_sync_tasks.append(_trigger_heartbeat_notifications(db, hid, price, currency))

        if post_sync_tasks:
            # We use return_exceptions=True to ensure one failure doesn't stop others
            await asyncio.gather(*post_sync_tasks, return_exceptions=True)
            logger.info(f"Batch Sync: Completed {len(post_sync_tasks)} post-sync operations (rooms/notifs).")

        return True

    except Exception as e:
        logger.error(f"Batch Sync Failure: {e}")
        # traceback.print_exc()
        return False



if __name__ == "__main__":
    # CLI Test Mode: Usage: export PYTHONPATH=$PYTHONPATH:. && python3 backend/services/monitor_service.py
    import asyncio

    print("Starting manual scheduler check...")
    asyncio.run(run_scheduler_check_logic())
    print("Check complete. See scheduler.log for details.")
