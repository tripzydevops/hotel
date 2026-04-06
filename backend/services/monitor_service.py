"""
Monitor Service.
Orchestrates the asynchronous background AI Agent-Mesh for price monitoring.
"""

import os
import logging
import traceback
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import BackgroundTasks
from supabase import Client
from backend.models.schemas import ScanOptions, MonitorResult
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)
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

    # Get all active hotels for user (exclude soft-deleted)
    query = (
        db.table("hotels")
        .select("*")
        .eq("user_id", str(user_id))
        .is_("deleted_at", "null")
    )
    
    # Filter by specific hotel IDs if provided in options
    if options and options.hotel_ids:
        hotel_id_strs = [str(hid) for hid in options.hotel_ids]
        query = query.in_("id", hotel_id_strs)
        
    hotels_result = query.execute()
    hotels = hotels_result.data or []

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
                
                # [KAIZEN] Log lock to session trace if possible
                try:
                    # session_id might not be defined yet in this scope
                    pass 
                except Exception:
                    pass

                return MonitorResult(
                    hotels_checked=0,
                    prices_updated=0,
                    alerts_generated=0,
                    errors=[f"SCAN_LOCKED: {reason}"],
                )

            # EXPLANATION: Unified Daily Manual Scan Limits
            # Enforces specific daily quotas requested by the user:
            # Trial (3), Starter (5), Pro (8), Enterprise (10)
            # This ensures stable SerpApi costs while allowing priority users higher flexibility.
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
            
            # [KAIZEN] Post-creation reasoning trace for the 18:00 cutoff
            if (not options or not options.check_in or str(options.check_in) == str(date.today())) and datetime.now().hour >= 18:
                try:
                    db.table("scan_sessions").update({
                        "reasoning_trace": [{"step": "Monitor", "level": "info", "message": "Advanced check-in to tomorrow due to 18:00 cutoff for Google Travel reliability.", "timestamp": datetime.now().timestamp()}]
                    }).eq("id", str(session_id)).execute()
                except: pass
        else:
            logger.error("Session creation returned no data. Scan will run without history trail.")
    except Exception as e:
        logger.error(f"CRITICAL: Session creation failed: {e}. Attempting to proceed with silent scan.")

    # Normalized Options for Background task
    normalized_options = ScanOptions(
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        currency=currency,
        hotel_ids=options.hotel_ids if options else None,
        skip_intelligence=options.skip_intelligence if options else False,
    )

    # 3.5 [KAIZEN] Sync Scheduler (Anti-Drift)
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
    # EXPLANATION: Lean Serverless Execution
    # Redis/Celery dependency has been removed to avoid Upstash free-tier limits.
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
                except Exception:
                    pass

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

        # 2. Get User Settings
        threshold = 2.0
        settings = {}
        try:
            settings_res = (
                db.table("settings")
                .select("*")
                .eq("user_id", str(user_id))
                .execute()
            )
            if settings_res.data:
                settings = settings_res.data[0]
                threshold = settings.get("threshold_percent", 2.0)
        except Exception:
            pass

        # 3. Phase 1: Scraper Agent
        logger.info(f"Starting ScraperAgent for {len(hotels)} hotels...")
        scraper_results = await scraper.run_scan(user_id, hotels, options, session_id)

        # 4. Phase 2: Analyst Agent
        logger.info("Starting AnalystAgent...")
        analysis = await analyst.analyze_results(
            user_id, scraper_results, threshold, settings=settings, options=options, session_id=session_id
        )

        # 4.5 Room Type Cataloging
        try:
            from backend.services.room_type_service import update_room_type_catalog

            await update_room_type_catalog(db, scraper_results, hotels)
        except Exception as e:
            logger.warning(f"Room Catalog failure: {e}")

        # 5. Phase 3: Notifier Agent
        if analysis.get("alerts"):
            try:
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
                        analysis["alerts"], settings, hotel_name_map
                    )
            except Exception as e:
                logger.warning(f"Notifier failure: {e}")

        # 6. Finalize Session
        final_status = "completed"
        if any(res.get("status") != "success" for res in scraper_results):
            final_status = "partial"

        if session_id:
            db.table("scan_sessions").update(
                {"status": final_status, "completed_at": datetime.now().isoformat()}
            ).eq("id", str(session_id)).execute()

        # 7. [KAIZEN] Final Sync Safety
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
                    except Exception:
                        pass
                
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
            except Exception:
                pass


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

        # 0. Cleanup Zombie Sessions
        # EXPLANATION: Long-running sessions (likely crashed/stalled) inflate the
        # "active" scan count and the system-wide error rate stats.
        # We mark sessions running for > 2 hours as failed to maintain signal integrity.
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
        except Exception as z_e:
            s_logger.error(f"CRON: Zombie cleanup failed: {z_e}")

        # 1. Get all active users with schedules due
        # KAİZEN: Robust ISO format for Supabase comparison (YYYY-MM-DDTHH:MM:SSZ)
        now_dt = datetime.now(timezone.utc).replace(microsecond=0)
        now_iso = now_dt.isoformat().replace("+00:00", "Z")
        s_logger.info(f"CRON: Checking for scans due before {now_iso}")

        # 1.0 Daily Market Sync (Eyes of Turkey)
        # EXPLANATION: We trigger a full market event sync once every 24 hours
        # to refresh fairs and announcements for all users.
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
                
                # Create a tracking session
                sync_session = supabase.table("scan_sessions").insert({
                    "user_id": None, # Global session
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
        except Exception as m_e:
            s_logger.error(f"CRON: Market sync failed: {m_e}")

        # 1.1 Fetch all active profiles
        result = (
            supabase.table("profiles")
            .select("id, next_scan_at, scan_frequency_minutes, subscription_status")
            .lte("next_scan_at", now_iso)
            .in_("subscription_status", ["active", "trial"])
            .execute()
        )

        active_due = result.data or []
        s_logger.info(f"CRON: Found {len(active_due)} active profiles due for scan.")

        if not active_due:
            return

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

        # 1.3 Pool all hotels (active only)
        hotels_res = (
            supabase.table("hotels")
            .select("*")
            .in_("user_id", due_ids)
            .is_("deleted_at", "null")
            .execute()
        )
        all_hotels = hotels_res.data or []

        # Group hotels by user for processing
        user_hotels_map = {}
        for h in all_hotels:
            uid = h["user_id"]
            if uid not in user_hotels_map:
                user_hotels_map[uid] = []
            user_hotels_map[uid].append(h)

        for user in active_due:
            try:
                user_id = user["id"]
                s_logger.info(f"Processing user {user_id}...")

                # 2. Update next_scan_at immediately (Locking mechanism)
                # KAİZEN: Precise Scheduling (Anti-Drift)
                # We calculate the NEXT scan relative to the INTENDED schedule time
                # instead of now() to prevent the "creeping drift" problem where
                # delays accumulate day over day.
                freq = (
                    settings_map.get(user_id)
                    or user.get("scan_frequency_minutes")
                    or 1440
                )
                intended_at_str = user.get("next_scan_at")

                if intended_at_str:
                    try:
                        intended_at = datetime.fromisoformat(
                            intended_at_str.replace("Z", "+00:00")
                        )
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

                # Use upsert to handle cases where the user may not have a profile record yet
                supabase.table("profiles").upsert({
                    "id": user_id,
                    "next_scan_at": next_run_iso,
                    "scan_frequency_minutes": freq
                }).execute()
                s_logger.info(
                    f"User {user_id}: Updated next_scan_at to {next_run_iso} (intended was {intended_at_str})"
                )

                # 3. Execute scan DIRECTLY (self-sufficient — no external worker needed)
                # EXPLANATION: Previous architecture dispatched to Celery/Redis, requiring
                # a separate VM worker to be alive. If the worker was down, scans silently
                # failed. Now we run the scan in-process so GitHub Actions is self-sufficient.
                hotels = user_hotels_map.get(user_id, [])
                if hotels:
                    # Create a scan session for tracking
                    session_id = None
                    try:
                        session_result = (
                            supabase.table("scan_sessions")
                            .insert(
                                {
                                    "user_id": user_id,
                                    "session_type": "scheduled",
                                    "hotels_count": len(hotels),
                                    "status": "pending",
                                }
                            )
                            .execute()
                        )
                        session_id = (
                            session_result.data[0]["id"]
                            if session_result.data
                            else None
                        )
                    except Exception as se:
                        s_logger.warning(
                            f"Session creation failed for scheduled scan: {se}"
                        )

                    # KAİZEN: Direct Execution (eliminates Celery worker dependency)
                    # Run the full scan pipeline in-process instead of dispatching to Redis.
                    # This ensures scans complete even without an external VM worker.
                    try:
                        s_logger.info(
                            f"Executing scan directly for user {user_id} ({len(hotels)} hotels)..."
                        )
                        await run_monitor_background(
                            user_id=UUID(user_id),
                            hotels=hotels,
                            options=None,
                            db=supabase,
                            session_id=UUID(session_id) if session_id else None,
                        )
                        s_logger.info(
                            f"Direct scan completed for user {user_id} (session={session_id})"
                        )
                    except Exception as direct_e:
                        s_logger.error(
                            f"Direct execution failed for {user_id}: {direct_e}"
                        )

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
