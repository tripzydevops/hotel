"""
Monitor Service.
Orchestrates the asynchronous background AI Agent-Mesh for price monitoring.
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
from backend.models.schemas import ScanOptions, MonitorResult
from backend.services.providers.dataforseo_provider import dataforseo_provider
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
        freq = (
            (profile_data.get("scan_frequency_minutes") or 1440)
            if not is_admin else 1440
        )
        # If we have settings, they override the profile default
        settings_check = db.table("settings").select("check_frequency_minutes").eq("user_id", str(user_id)).execute()
        if settings_check.data:
            freq = settings_check.data[0].get("check_frequency_minutes") or freq
            
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
            from backend.services.room_type_service import update_room_type_catalog
            await update_room_type_catalog(db, scraper_results, hotels)
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
            # FIX: Fetch both profile and settings to ensure frequency consistency
            profile_res = db.table("profiles").select("next_scan_at, scan_frequency_minutes").eq("id", str(user_id)).execute()
            settings_res = db.table("settings").select("check_frequency_minutes").eq("user_id", str(user_id)).execute()
            
            if profile_res.data:
                prof = profile_res.data[0]
                nxt = prof.get("next_scan_at")
                
                # If next_scan_at is in the past or missing, force advance it
                now_utc = datetime.now(timezone.utc)
                is_due = True
                if nxt:
                    try:
                        nxt_dt = datetime.fromisoformat(nxt.replace("Z", "+00:00"))
                        if nxt_dt > now_utc:
                            is_due = False
                    except (Exception) as parse_e:
                        logger.debug(f"Failed to parse next_scan_at: {str(parse_e)}")
                
                if is_due:
                    # [FIX] Prefer settings.check_frequency_minutes as source of truth
                    freq = 1440
                    if settings_res.data and settings_res.data[0].get("check_frequency_minutes"):
                        freq = settings_res.data[0].get("check_frequency_minutes")
                    elif prof.get("scan_frequency_minutes"):
                        freq = prof.get("scan_frequency_minutes")
                        
                    new_nxt = (now_utc + timedelta(minutes=freq)).isoformat().replace("+00:00", "Z")
                    # Use upsert for profile sync safety to handle missing records
                    db.table("profiles").upsert({
                        "id": str(user_id),
                        "next_scan_at": new_nxt,
                        "scan_frequency_minutes": freq
                    }).execute()
                    logger.info(f"Background: Force-advanced next_scan_at for {user_id} to {new_nxt}")
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
    1. Identifies active users whose 'next_scan_at' timestamp is in the past.
    2. Calculates the 'next_run' interval based on user settings (default: 24h).
    3. Updates 'next_scan_at' immediately to act as a soft-lock (preventing duplicate dispatches).
    4. Dispatches the scan task to the Redis/Celery queue for VM-side execution.
    """
    s_logger = get_scheduler_logger()
    s_logger.info("CRON: Starting scheduler check...")
    from backend.utils.db import get_supabase

    try:
        supabase = get_supabase(admin=True)
        if not supabase:
            logger.error("CRON: Database unavailable")
            return

        # 1. RUN SYSTEM HEARTBEAT (Hotel-Centric)
        await run_system_heartbeat(supabase)
        
        # 2. PROCESS COMPLETED TASKS
        await process_system_scans(supabase)

        # 3. Cleanup Zombie Sessions
        # Cleanup Zombie Sessions: Sessions running for > 2 hours are marked failed.
        try:
            zombie_cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=2)
            ).isoformat()
            zombies = (
                supabase.table("scan_sessions")
                .select("id")
                .in_("status", ["pending", "running"])
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
        except (Exception) as z_e:
            s_logger.error(f"CRON: Zombie cleanup failed: {str(z_e)}")

        # 1. Get all active users with schedules due
        # Robust ISO format for Supabase comparison (YYYY-MM-DDTHH:MM:SSZ)
        now_dt = datetime.now(timezone.utc).replace(microsecond=0)
        now_iso = now_dt.isoformat().replace("+00:00", "Z")
        s_logger.info(f"CRON: Checking for scans due before {now_iso}")

        # Daily Market Sync (Eyes of Turkey)
        # We trigger a full market event sync once every 24 hours.
        try:
            today_date = date.today().isoformat()
            # Use scan_sessions or a dedicated sync_logs table to track?
            # We'll use a specific session_type 'market_sync' for simplicity.
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
                
                # Create a tracking session for GLOBAL sync
                sync_session = supabase.table("scan_sessions").insert({
                    "user_id": None, # Global session (system-wide)
                    "session_type": "market_sync",
                    "status": "running",
                    "hotels_count": 0
                }).execute()
                
                sync_id = sync_session.data[0]["id"] if sync_session.data else None
                
                # Run scrapers
                from backend.services.market.tobb_scraper import TOBBScraper
                from backend.services.market.tga_scraper import TGAScraper
                
                tobb = TOBBScraper(supabase)
                tga = TGAScraper(supabase)
                
                # We run them sequentially to avoid Supabase connection pressure
                tobb_res = await tobb.scrape_to_supabase()
                tga_res = await tga.scrape_to_supabase()
                
                status = "completed" if (tobb_res.get("status") == "success" and tga_res.get("status") == "success") else "partial"
                
                if sync_id:
                    supabase.table("scan_sessions").update({
                        "status": status,
                        "completed_at": datetime.now().isoformat(),
                        "reasoning_trace": [
                            f"TOBB: {tobb_res}",
                            f"TGA: {tga_res}"
                        ]
                    }).eq("id", sync_id).execute()
                
                s_logger.info(f"CRON: Market sync complete. Status: {status}")
            else:
                s_logger.info("CRON: Market sync already completed for today.")
        except (Exception) as m_e:
            s_logger.error(f"CRON: Market sync failed: {str(m_e)}")

        # 1.1 Fetch a batch of active profiles due for scan
        # Use batching (limit 5) to prevent Vercel timeout issues.
        # This ensures we process a manageable chunk and advance their timestamps
        # before the next cron run picks up the next batch.
        result = (
            supabase.table("profiles")
            .select("id, next_scan_at, scan_frequency_minutes, subscription_status")
            .lte("next_scan_at", now_iso)
            .in_("subscription_status", ["active", "trial"])
            .order("next_scan_at", desc=False) # Process oldest first
            .limit(5)
            .execute()
        )

        active_due = result.data or []
        s_logger.info(f"CRON: Selected batch of {len(active_due)} profiles due for scan.")

        if not active_due:
            return

        # 1.1.5 IMMEDIATE PROACTIVE LOCKING
        # Before we do ANYTHING expensive (like fetching hotels or starting scans),
        # we advance the next_scan_at for these users. This ensures that even if 
        # the function times out, they won't be picked up again immediately.
        # This prevents the 'stuck in the past' loop when Vercel kills the process.
        for user in active_due:
            try:
                user_id = user["id"]
                freq = user.get("scan_frequency_minutes") or 1440
                next_run_dt = now_dt + timedelta(minutes=freq)
                next_run_iso = next_run_dt.isoformat().replace("+00:00", "Z")
                
                supabase.table("profiles").update({
                    "next_scan_at": next_run_iso
                }).eq("id", user_id).execute()
                
                s_logger.info(f"CRON: Pre-locked user {user_id} to next scan at {next_run_iso}")
            except (Exception) as lock_e:
                s_logger.error(f"CRON: Failed to pre-lock user {user['id']}: {str(lock_e)}")

        # 1.2 Fetch actual user settings for frequency override
        due_ids = [u["id"] for u in active_due]
        settings_res = (
            supabase.table("settings")
            .select("user_id, check_frequency_minutes")
            .in_("user_id", due_ids)
            .execute()
        )
        settings_map = {
            s["user_id"]: s["check_frequency_minutes"] for s in settings_res.data or []
        }

        # 1.3 Pool all hotels via M2M join (filtering soft-deleted in-memory)
        res = (
            supabase.table("user_hotels")
            .select("user_id, hotel_id, is_target, pricing_dna, preferred_currency, fixed_check_in, fixed_check_out, default_adults, hotels(*)")
            .in_("user_id", due_ids)
            .execute()
        )
        
        all_hotels = []
        for mapping in (res.data or []):
            if mapping.get("hotels"):
                h_data = mapping["hotels"]
                if h_data.get("deleted_at"):
                    continue
                h_data["user_id"] = mapping["user_id"] # Inject for grouping below
                
                # Override specialized settings from user_hotels association
                h_data["is_target_hotel"] = mapping.get("is_target", False)
                h_data["pricing_dna"] = mapping.get("pricing_dna")
                h_data["preferred_currency"] = mapping.get("preferred_currency", "USD")
                h_data["fixed_check_in"] = mapping.get("fixed_check_in")
                h_data["fixed_check_out"] = mapping.get("fixed_check_out")
                h_data["default_adults"] = mapping.get("default_adults", 2)
                
                all_hotels.append(h_data)

        # Group hotels by user for processing
        user_hotels_map = {}
        for h in all_hotels:
            uid = h["user_id"]
            if uid not in user_hotels_map:
                user_hotels_map[uid] = []
            user_hotels_map[uid].append(h)

        # 1.4 Cleanup zombies (already in batch, but as a secondary safety)
        # We don't want to run the expensive zombie cleanup every time if we can avoid it,
        # but it keeps the scan_sessions table clean.

        # 2. FINISHED: Consolidate logic. 
        # We no longer run per-user scans here. 
        # Instead, run_system_heartbeat handles background global monitoring for ALL active hotels.
        # This reduces DataForSEO costs by 80%+.
        s_logger.info("CRON: Per-user scheduled scanning is now handled by Global System Heartbeat.")

    except Exception as e:
        s_logger.critical(f"CRON ERROR: {e}")
        s_logger.error(traceback.format_exc())

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
        interval = settings.get("scan_interval_hours", 24)
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
        
        if not is_due:
            # next_scan_at usually set by the updater, but check if we should update UI info
            return

        s_logger.info(f"Heartbeat: Global system scan starting (Interval: {interval}h)...")

        # 3. Fetch all unique monitored hotels
        monitored_res = (
            db.table("user_hotels")
            .select("hotel_id, hotels(name, location, serp_api_id)")
            .eq("is_monitored", True)
            .execute()
        )

        if not monitored_res.data:
            s_logger.info("Heartbeat: No monitored hotels found.")
            return

        # Deduplicate by Unique Token (serp_api_id) to save credits
        criteria_groups = {} # token -> [list_of_ids]
        criteria_data = {}   # token -> hotel_metadata
        
        for item in monitored_res.data:
            h = item.get("hotels")
            if not h: continue
            
            # Use serp_api_id as the primary unique key
            token = h.get("serp_api_id")
            if not token:
                # Fallback to name/location only if serp_api_id is missing
                token = f"{h['name'].lower().strip()}|{h['location'].lower().strip()}"
            
            if token not in criteria_groups:
                criteria_groups[token] = []
                criteria_data[token] = h
            criteria_groups[token].append(item["hotel_id"])

        if not criteria_groups:
            s_logger.info("Heartbeat: No valid monitored hotels found after deduplication.")
            return

        s_logger.info(f"Heartbeat: Submitting {len(criteria_groups)} unique search tasks (from {len(monitored_res.data)} monitored records)...")

        # 4. Prepare DataForSEO Tasks (Today -> Tomorrow, 2 Adults)
        check_in = date.today().strftime("%Y-%m-%d")
        check_out = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        task_params = []
        for key, h_ids in criteria_groups.items():
            h_data = criteria_data[key]
            # Use the first ID as the primary reference tag
            primary_id = h_ids[0]
            task_params.append({
                "location_name": h_data["location"],
                "keyword": h_data["name"],
                "check_in": check_in,
                "check_out": check_out,
                "adults": 2,
                "currency": "TRY",
                "tag": str(primary_id) # Critical: use tag to identify results
            })

        batch_size = 100
        total_tasks_posted = 0
        for i in range(0, len(task_params), batch_size):
            batch = task_params[i : i + batch_size]
            task_ids = await dataforseo_provider.post_price_tasks(batch)
            if task_ids:
                total_tasks_posted += len(task_ids)

        s_logger.info(f"Heartbeat: Successfully posted {total_tasks_posted} scanning tasks.")

        # 5. Update Admin Settings
        next_scan = now + timedelta(hours=interval)
        try:
            db.table("admin_settings").update({
                "last_global_scan_at": now.isoformat(),
                "next_global_scan_at": next_scan.isoformat()
            }).eq("id", settings["id"]).execute()
        except Exception as e:
            s_logger.warning(f"Heartbeat: Failed to update admin settings timestamp: {e}")

    except Exception as e:
        s_logger.error(f"Heartbeat Failure: {e}")


async def process_system_scans(db: Client):
    """
    Checks for completed DataForSEO tasks and updates hotel prices.
    Uses 'tag' from results to map back to hotel_id.
    """
    s_logger = get_scheduler_logger()
    try:
        # 1. Get completed task IDs
        completed_ids = await dataforseo_provider.get_completed_tasks()
        if not completed_ids:
            return

        s_logger.info(f"Task Processor: Found {len(completed_ids)} completed scanning tasks.")

        for tid in completed_ids:
            try:
                # 2. Fetch full results
                result = await dataforseo_provider.fetch_task_results(tid)
                if not result or result.get("status") != "success":
                    continue

                # Use tag (h_id) passed during submission
                h_id = result.get("tag")
                price = result.get("price")
                currency = result.get("currency")
                
                if not price or not h_id:
                    continue

                # 3. Update Hotels and History
                try:
                    # 3. Get the hotel info to find siblings sharing the same property token
                    primary_res = db.table("hotels").select("name, location, serp_api_id").eq("id", h_id).single().execute()
                    if not primary_res.data:
                        continue
                    
                    hotel_ref = primary_res.data
                    serp_id = hotel_ref.get("serp_api_id")
                    h_name = hotel_ref["name"]
                    h_location = hotel_ref["location"]

                    if serp_id:
                        # Priority 1: Match all variations sharing the same unique Token
                        matching_hotels = db.table("hotels").select("id, current_price").eq("serp_api_id", serp_id).execute()
                    else:
                        # Fallback: Match by name/location
                        matching_hotels = db.table("hotels").select("id, current_price").eq("name", h_name).eq("location", h_location).execute()
                    
                    if not matching_hotels.data:
                        continue

                    for h_obj in matching_hotels.data:
                        target_id = h_obj["id"]
                        prev_price_val = h_obj.get("current_price")
                        
                        # Update each entity
                        db.table("hotels").update({
                            "current_price": price,
                            "previous_price": prev_price_val,
                            "last_scanned_at": datetime.now(timezone.utc).isoformat(),
                            "last_scan": datetime.now(timezone.utc).isoformat()
                        }).eq("id", target_id).execute()

                        # Insert history for each
                        db.table("price_logs").insert({
                            "hotel_id": target_id,
                            "price": price,
                            "currency": currency,
                            "source": "System Heartbeat (Deduplicated)",
                            "recorded_at": datetime.now(timezone.utc).isoformat()
                        }).execute()

                        # 4. Trigger per-user notifications for this specific entity
                        await _trigger_heartbeat_notifications(db, target_id, price, currency)
                        
                    s_logger.info(f"Task Processor: Updated {len(matching_hotels.data)} variations sharing token '{serp_id or h_name}' to {price} {currency}")

                except Exception as e:
                    s_logger.error(f"Failed to sync hotel results for {h_id}: {e}")

            except Exception as item_e:
                s_logger.error(f"Task Processor: Error processing task {tid}: {item_e}")

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
        query = db.table("user_hotels").select("user_id, hotel_id, hotels(name, serp_api_id)").eq("hotel_id", hotel_id).eq("is_monitored", True)
        users_res = query.execute()
        if not users_res.data:
            return

        hotel_data = users_res.data[0].get("hotels", {})
        hotel_name = hotel_data.get("name", "Unknown Hotel")
        serp_id = hotel_data.get("serp_api_id")

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
                    "currency": currency,
                    "metadata": {"pct": change_pct}
                }).execute()

                # Dispatch notification
                if alert_res.data:
                    await notifier.dispatch_alerts([alert_res.data[0]], settings, {hotel_id: hotel_name})

    except Exception as e:
        logger.error(f"Heartbeat Notifier Error for hotel {hotel_id}: {e}")


if __name__ == "__main__":
    # CLI Test Mode: Usage: export PYTHONPATH=$PYTHONPATH:. && python3 backend/services/monitor_service.py
    import asyncio

    print("Starting manual scheduler check...")
    asyncio.run(run_scheduler_check_logic())
    print("Check complete. See scheduler.log for details.")
