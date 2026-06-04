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

import asyncio
import logging
import os
import traceback
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, cast
import uuid
from uuid import UUID

from backend.models.schemas import SCAN_PULSE_INTERVAL_HOURS
from backend.services.location_service import LocationService
from backend.services.providers.dataforseo_provider import dataforseo_provider
from backend.services.scan_persistence import ScanPersistenceService
from backend.utils.db import get_insforge_db, InsForgeClient
from backend.utils.logger import get_logger


logger = get_logger(__name__)


# Canonical log path — single source of truth for both writer and reader.
# Aligning to project root for visibility in admin dashboard
SCHEDULER_LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCHEDULER_LOG_PATH = os.path.join(SCHEDULER_LOG_DIR, "scheduler.log")


# Dedicated Scheduler Logging
def get_scheduler_logger():
    s_logger = logging.getLogger("scheduler")
    if not s_logger.handlers:
        from logging.handlers import RotatingFileHandler

        # Ensure the logs directory exists
        os.makedirs(SCHEDULER_LOG_DIR, exist_ok=True)

        try:
            handler = RotatingFileHandler(
                SCHEDULER_LOG_PATH, maxBytes=5 * 1024 * 1024, backupCount=3
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
    insforge: InsForgeClient,
    action_type: str,
    status: str = "success",
    status_detail: Optional[str] = None,
):
    """
    Logs a system event (pulse or mesh activity) to query_logs for feed visibility.
    """
    try:
        res = (
            insforge.table("query_logs")
            .insert(
                {
                    "user_id": None,  # System records have no owner
                    "action_type": action_type,
                    "status": status,
                    "status_detail": status_detail,
                    "hotel_name": "System Mesh"
                    if action_type == "mesh_activity"
                    else "Antigravity OS",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )

        # KAİZEN: Handle silent Failures
        if hasattr(res, "error") and res.error:
            logger.error(f"Pulse recording failed (PostgREST Error): {res.error}")
        elif not res.data:
            logger.warning(f"Pulse recording returned no data for {action_type}")

    except Exception as e:
        logger.error(f"Pulse recording exception: {e}", exc_info=True)


async def run_scheduler_check_logic(insforge: Optional[InsForgeClient] = None):
    """
    Main entry point for the autonomous scheduler.
    Performs heartbeat checks, data processing, and cleanup.
    """
    s_logger = get_scheduler_logger()
    s_logger.info("CRON: Starting scheduler check...")

    # Use admin client for system-wide processing
    insforge = insforge or get_insforge_db(admin=True)
    if not insforge:
        s_logger.error("CRON: Could not initialize InsForge.")
        return

    # 0. RESOLVE UNRECOGNIZED LOCATIONS
    # This pre-scan phase maps human-readable hotel locations to DataForSEO location_codes.
    try:
        loc_service = LocationService(insforge)
        await loc_service.resolve_hotel_locations()
    except Exception as rl_e:
        s_logger.warning(f"CRON: Location resolution phase had issues: {rl_e}")

    try:
        # 1. RUN SYSTEM PULSE (5-minute heartbeat for UI 'Alive' feeling)
        try:
            five_mins_ago = (
                datetime.now(timezone.utc) - timedelta(minutes=5)
            ).isoformat()
            recent_pulse = (
                insforge.table("query_logs")
                .select("id")
                .eq("action_type", "system_pulse")
                .gt("created_at", five_mins_ago)
                .limit(1)
                .execute()
            )
            if not recent_pulse.data:
                await record_system_pulse(insforge, "system_pulse")
                s_logger.info("CRON: Emitted system heartbeat pulse.")
        except Exception as p_e:
            s_logger.debug(f"Pulse emission skipped: {p_e}")

        # 1.1 INITIALIZE STALE PROFILES (Self-Healing)
        # REMOVED: next_scan_at is deprecated

        # 1.5 RUN SYSTEM HEARTBEAT (New Global 4h Standard)
        # This function handles its own timing checks via admin_settings table.
        try:
            await run_system_heartbeat(insforge)
        except Exception as h_e:
            s_logger.error(f"CRON: Heartbeat submission error: {h_e}")

        # 2. PROCESS COMPLETED TASKS (DataForSEO result collector)
        # Always run this as a safety net for webhooks.
        try:
            await process_system_scans(insforge)
        except Exception as s_e:
            s_logger.error(f"CRON: Result collection error: {s_e}")

        # 3. Cleanup Zombie Sessions and Tasks
        try:
            # 3.1. Cleanup sessions (4-hour cutoff, task-aware)
            # [FIX 2026-05-01] Increased from 2h to 4h to prevent premature reaping
            # of sessions whose DataForSEO tasks are still being processed.
            zombie_cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=4)
            ).isoformat()
            zombies = (
                insforge.table("scan_sessions")
                .select("id")
                .in_("status", ["pending", "running", "processing"])
                .lt("created_at", zombie_cutoff)
                .execute()
            )

            if zombies.data:
                z_ids = [cast(dict, z)["id"] for z in zombies.data]

                # [FIX 2026-05-01] Task-aware cleanup: check if any tasks are
                # still pending at the provider before force-failing the session.
                truly_dead_ids = []
                for z_id in z_ids:
                    try:
                        # Check via scan_batches -> session_id
                        batch_res = (

                            insforge.table("scan_batches")
                            .select("id")
                            .eq("session_id", z_id)
                            .execute()
                        )
                        has_active = False
                        if batch_res.data:
                            b_ids = [cast(dict, b)["id"] for b in batch_res.data]
                            for b_id in b_ids:
                                pending = (
                                    insforge.table("scan_tasks")
                                    .select("id")
                                    .eq("status", "pending")
                                    .eq("batch_id", b_id)
                                    .limit(1)
                                    .execute()
                                )
                                if pending.data:
                                    has_active = True
                                    break

                        if has_active:
                            s_logger.info(
                                f"CRON: Session {z_id} still has active tasks — skipping zombie cleanup."
                            )
                        else:
                            truly_dead_ids.append(z_id)
                    except Exception as chk_e:
                        # If we can't check, err on the side of cleanup
                        s_logger.warning(f"CRON: Task check failed for session {z_id}: {chk_e}")
                        truly_dead_ids.append(z_id)

                if truly_dead_ids:
                    s_logger.warning(
                        f"CRON: Cleaning up {len(truly_dead_ids)} confirmed zombie sessions: {truly_dead_ids}"
                    )
                    insforge.table("scan_sessions").update(
                        {
                            "status": "failed",
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                            "reasoning_trace": "Zombie cleanup: session exceeded 4h timeout with no active provider tasks.",
                        }
                    ).in_("id", truly_dead_ids).execute()

            # 3.2. Cleanup stale scan_tasks (6-hour cutoff)
            task_stale_cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=6)
            ).isoformat()
            stale_tasks = (
                insforge.table("scan_tasks")
                .select("id, batch_id")
                .eq("status", "pending")
                .lt("created_at", task_stale_cutoff)
                .execute()
            )

            if stale_tasks.data:
                st_ids = [cast(dict, tk)["id"] for tk in stale_tasks.data]
                s_logger.warning(
                    f"CRON: Cleaning up {len(st_ids)} stale scan_tasks (abandoned): {st_ids}"
                )
                insforge.table("scan_tasks").update(
                    {
                        "status": "failed",
                        "error_message": "Abandoned: No response from provider after 6h",
                    }
                ).in_("id", st_ids).execute()

                # Also increment failure count for their batches
                batch_ids = list(
                    set(
                        [
                            cast(dict, tk)["batch_id"]
                            for tk in stale_tasks.data
                            if cast(dict, tk).get("batch_id")
                        ]
                    )
                )
                for b_id in batch_ids:
                    insforge.rpc("increment_batch_failures", {"b_id": b_id}).execute()
        except Exception as z_e:
            s_logger.error(f"CRON: Stale cleanup failed: {str(z_e)}")

        # 4. DAILY MARKET SYNC (Eyes of Turkey)
        # Maintained once per 24 hours for regional intelligence.
        try:
            today_date = date.today().isoformat()
            last_sync = (
                insforge.table("scan_sessions")
                .select("id")
                .eq("session_type", "market_sync")
                .gte("created_at", f"{today_date}T00:00:00Z")
                .limit(1)
                .execute()
            )

            if not last_sync.data:
                s_logger.info(
                    "CRON: Triggering global market intelligence sync (Eyes of Turkey)..."
                )

                sync_session = (
                    insforge.table("scan_sessions")
                    .insert(
                        {
                            "user_id": None,
                            "session_type": "market_sync",
                            "status": "running",
                            "hotels_count": 0,
                        }
                    )
                    .execute()
                )

                sync_id = cast(dict, sync_session.data[0])["id"] if sync_session.data else None

                from backend.services.market.tga_scraper import TGAScraper
                from backend.services.market.tobb_scraper import TOBBScraper

                tobb = TOBBScraper(insforge)
                tga = TGAScraper(insforge)

                tobb_res = await tobb.scrape_to_insforge()
                tga_res = await tga.scrape_to_insforge()

                status = (
                    "completed"
                    if (
                        tobb_res.get("status") == "success"
                        and tga_res.get("status") == "success"
                    )
                    else "partial"
                )

                if sync_id:
                    total_events = int(tobb_res.get("processed", 0)) + int(tga_res.get("processed", 0))
                    insforge.table("scan_sessions").update(
                        {
                            "status": status,
                            "hotels_count": total_events,
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                            "reasoning_trace": [f"TOBB: {tobb_res}", f"TGA: {tga_res}"],
                        }
                    ).eq("id", sync_id).execute()

                s_logger.info(f"CRON: Market sync complete. Status: {status}")
            else:
                s_logger.info("CRON: Market sync already completed for today.")
        except Exception as m_e:
            s_logger.error(f"CRON: Market sync failed: {str(m_e)}")

        s_logger.info("CRON: Global system cycle check complete.")

    except Exception as e:
        s_logger.critical(f"CRON ERROR: {e}")
        s_logger.error(traceback.format_exc())


async def run_system_heartbeat(insforge: InsForgeClient):
    """
    Checks if a global system-wide hotel scan is due.
    If due, submits all unique monitored hotels to the DataForSEO Task API.
    """
    s_logger = get_scheduler_logger()
    session_id = None
    
    # AGENT_FIX: Verify if the client has elevated privileges
    is_admin = getattr(insforge, "is_admin", False)
    s_logger.info(f"Heartbeat: Pulse check using client role: {'SERVICE_ROLE' if is_admin else 'ANON'}")
    
    try:
        # 1. Fetch Admin Settings
        settings_res = insforge.table("admin_settings").select("*").limit(1).execute()
        if not settings_res.data:
            s_logger.warning("Heartbeat: No admin settings found. Skipping.")
            return

        settings = cast(dict, settings_res.data[0])
        # --- Autonomous Monitoring Protocol [KAIZEN 2026] ---
        # 1. Scope: Only hotels marked as 'is_monitored' in user_hotels are considered.
        # 2. Precision: Scans are strictly enforced for hotels with a 'property_token' or 'serp_api_id'.
        #    This prevents broad/unreliable keyword searches and ensures absolute pricing accuracy.
        # 3. Governance: Scan sessions are recorded with user_id=None for global system visibility.
        # 4. Frequency: Defined by SCAN_PULSE_INTERVAL_HOURS.
        interval = settings.get("scan_interval_hours", SCAN_PULSE_INTERVAL_HOURS)
        currency = settings.get("default_currency", "TRY")
        last_scan = settings.get("last_global_scan_at")
        
        deep_scan_interval = settings.get("deep_scan_interval_hours", 168)  # Default 7 days
        last_deep_scan = settings.get("last_deep_scan_at")
        
        # [2026-05-04] Get system occupancy defaults
        default_adults = settings.get("default_adults", 2)
        default_children = settings.get("default_children_ages", [])
        
        now = datetime.now(timezone.utc)

        # 2. Check overlap
        is_due = True
        if last_scan:
            try:
                last_dt = datetime.fromisoformat(last_scan.replace("Z", "+00:00"))
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                if (now - last_dt).total_seconds() < (interval * 3600):
                    is_due = False
            except Exception:
                is_due = True

        if not is_due and not getattr(insforge, "_force_heartbeat", False):
            return

        is_deep_scan_due = True
        if last_deep_scan:
            try:
                last_deep_dt = datetime.fromisoformat(last_deep_scan.replace("Z", "+00:00"))
                if last_deep_dt.tzinfo is None:
                    last_deep_dt = last_deep_dt.replace(tzinfo=timezone.utc)
                if (now - last_deep_dt).total_seconds() < (deep_scan_interval * 3600):
                    is_deep_scan_due = False
            except Exception:
                is_deep_scan_due = True
                
        # If forced heartbeat has deep_scan set, override
        if getattr(insforge, "_force_deep_scan", False):
            is_deep_scan_due = True

        s_logger.info(f"Heartbeat: Global system scan starting (Interval: {interval}h, Deep Scan: {is_deep_scan_due})...")

        # 3. Get monitored hotels first (to set explicit count in initial log)
        monitored_res = (
            insforge.table("user_hotels")
            .select("hotel_id, preferred_currency, hotels(id, name, location, property_token, serp_api_id, location_code, latitude, longitude, currency, scan_adults, scan_children_ages, last_rich_scan_at)")
            .eq("is_monitored", True)
            .execute()
        )
        
        # AGENT_FIX: Detailed logging for query results
        if not monitored_res.data:
            s_logger.warning(f"Heartbeat: user_hotels query returned 0 rows. (Admin Client: {is_admin})")
            if not is_admin:
                s_logger.critical("Heartbeat SECURITY ALERT: Running system pulse with ANON client. RLS is likely blocking hotel discovery.")
        else:
            s_logger.info(f"Heartbeat: Found {len(monitored_res.data)} raw monitored hotel entries.")
        
        stale_hotel_ids = set()
        if monitored_res.data:
            # Extract distinct hotel IDs
            all_monitored_hids = list(set(
                str(item["hotel_id"]) for item in monitored_res.data 
                if item.get("hotel_id") and item.get("hotels")
            ))
            
            if all_monitored_hids:
                try:
                    # Query recent completed pricing tasks for these hotels (last 5 per hotel on average)
                    tasks_check = (
                        insforge.table("scan_tasks")
                        .select("hotel_id, status, created_at, task_type")
                        .in_("hotel_id", all_monitored_hids)
                        .eq("status", "completed")
                        .eq("task_type", "price_search")
                        .order("created_at", desc=True)
                        .limit(len(all_monitored_hids) * 5)
                        .execute()
                    )
                    
                    # Query latest price log for these hotels
                    price_logs_check = (
                        insforge.table("price_logs")
                        .select("hotel_id, recorded_at")
                        .in_("hotel_id", all_monitored_hids)
                        .order("recorded_at", desc=True)
                        .limit(len(all_monitored_hids) * 10)
                        .execute()
                    )
                    
                    # Group completed task creation times by hotel_id
                    from collections import defaultdict
                    hotel_completed_tasks = defaultdict(list)
                    for t in (tasks_check.data or []):
                        hotel_completed_tasks[str(t["hotel_id"])].append(t["created_at"])
                        
                    # Group latest price log by hotel_id
                    latest_price_log_time = {}
                    for p in (price_logs_check.data or []):
                        hid = str(p["hotel_id"])
                        if hid not in latest_price_log_time:
                            latest_price_log_time[hid] = p["recorded_at"]
                            
                    # Check each hotel for repeated zero-pricing rate anomaly
                    for hid in all_monitored_hids:
                        times = hotel_completed_tasks[hid]
                        # We require at least 3 completed tasks to detect repeated failure
                        if len(times) >= 3:
                            # The 3rd completed task time (cutoff)
                            cutoff_str = times[2]
                            latest_log_str = latest_price_log_time.get(hid)
                            
                            # Parse timestamps
                            cutoff_dt = datetime.fromisoformat(cutoff_str.replace("Z", "+00:00"))
                            if latest_log_str:
                                latest_log_dt = datetime.fromisoformat(latest_log_str.replace("Z", "+00:00"))
                                # If the latest price log is older than the oldest of the last 3 completed tasks,
                                # then all of those 3 runs yielded zero prices/empty results (no price logs written)
                                if latest_log_dt < cutoff_dt:
                                    stale_hotel_ids.add(hid)
                            else:
                                # If no price logs exist at all but we have 3 completed tasks, it's stale
                                stale_hotel_ids.add(hid)
                                
                    if stale_hotel_ids:
                        s_logger.warning(f"Heartbeat: Detected {len(stale_hotel_ids)} hotels with repeated zero-pricing rate anomalies: {list(stale_hotel_ids)}")
                except Exception as detect_e:
                    s_logger.error(f"Heartbeat: Stale token detection failed: {detect_e}")

        # Deduplicate and validate (Must have property_token or serp_api_id)
        hotels_to_scan = []
        seen_hotels = set()
        unmapped_hotels = []

        if monitored_res.data:
            for item_raw in monitored_res.data:
                item = cast(dict, item_raw)
                h = item.get("hotels")
                if not h:
                    continue
                
                hid = h.get("id")
                if hid in seen_hotels:
                    continue
                
                # Check if this hotel's token is stale
                is_stale_token = str(hid) in stale_hotel_ids
                if is_stale_token:
                    s_logger.warning(f"Heartbeat: Hotel '{h.get('name')}' (ID: {hid}) has a stale token. Forcing keyword fallback scan.")
                    h["_is_stale_fallback"] = True
                    h["_original_property_token"] = h.get("property_token")
                    h["_original_serp_api_id"] = h.get("serp_api_id")
                    h["property_token"] = None
                    h["serp_api_id"] = None

                # [PROTOCOL 2026] ENFORCE TOKEN REQUIREMENT
                # If it's not a stale fallback, it MUST have a property_token or serp_api_id
                if not is_stale_token and not (h.get("property_token") or h.get("serp_api_id")):
                    unmapped_hotels.append(h.get("name", "Unknown"))
                    continue

                pref_currency = item.get("preferred_currency")
                if pref_currency:
                    h["currency"] = pref_currency
                
                hotels_to_scan.append(h)
                seen_hotels.add(hid)

        if unmapped_hotels:
            s_logger.warning(f"Heartbeat: Skipping {len(unmapped_hotels)} monitored hotels missing property tokens: {', '.join(unmapped_hotels[:5])}...")

        # 4. Pre-flight: Verify DataForSEO credentials are available
        # [FIX 2026-05-20] Prevents empty ghost sessions when running in environments
        # without provider credentials (e.g., Vercel Edge cron). Without this check,
        # the session is created and last_global_scan_at is updated, blocking the next
        # legitimate GitHub Actions scan from executing.
        dfs_login = os.environ.get("DATAFORSEO_LOGIN") or os.environ.get("DATAFORSEO_API_KEY")
        dfs_password = os.environ.get("DATAFORSEO_PASSWORD")
        if not dfs_login or not dfs_password:
            s_logger.warning("Heartbeat: DataForSEO credentials not available in this environment. Skipping scan to avoid ghost sessions.")
            return

        # 5. Create Monitoring Session
        session_id = str(uuid.uuid4())
        try:
            # Record Heartbeat Start
            # AGENT_FIX: Record in scan_sessions with NULL user_id for global dashboard visibility
            insforge.table("scan_sessions").insert({
                "id": session_id,
                "user_id": None,  # NULL for all users
                "session_type": "autonomous_heartbeat",
                "status": "running",
                "hotels_count": len(hotels_to_scan),
                "currency": currency,
                "check_in_date": datetime.now(timezone.utc).date().isoformat(),
                "check_out_date": (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
            }).execute()

            insforge.table("market_heartbeat_logs").insert({
                "session_id": session_id,
                "status": "started",
                "trigger_source": None, # AGENT_FIX: Use None for system-triggered scans to avoid UUID conversion errors
                "hotels_count": len(hotels_to_scan),
                "is_deep_scan": is_deep_scan_due
            }).execute()
        except Exception as sle:
            s_logger.error(f"Heartbeat: Failed to record session start: {sle}")

        if not hotels_to_scan:
            s_logger.info("Scheduler: No monitored hotels found.")
            insforge.table("market_heartbeat_logs").update({
                "status": "completed", 
                "end_time": datetime.now(timezone.utc).isoformat()
            }).eq("session_id", session_id).execute()
            
            try:
                insforge.table("scan_sessions").update({
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", session_id).execute()
            except Exception as upd_e:
                s_logger.warning(f"Heartbeat: Failed to complete scan_sessions (no hotels): {upd_e}")
                
            return

        # 6. Submit to DataForSEO (BEFORE updating admin settings)
        # [FIX 2026-05-20] Moved admin_settings update to AFTER successful submission.
        # Previously, last_global_scan_at was updated before submission, so if submission
        # failed, the next scan would be skipped for the entire interval period.
        total = await dataforseo_provider.submit_hotel_scan_batch(
            insforge,
            hotels=hotels_to_scan,
            check_in=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
            check_out=(now + timedelta(days=2)).strftime("%Y-%m-%d"),
            deep_scan=is_deep_scan_due,
            session_id=session_id,
            currency=currency,
            adults=default_adults,
            children=default_children
        )

        # 7. Update Admin Settings ONLY after confirmed submission
        if total > 0:
            next_scan = now + timedelta(hours=interval)
            update_data = {
                "last_global_scan_at": now.isoformat(),
                "next_global_scan_at": next_scan.isoformat(),
            }
            if is_deep_scan_due:
                update_data["last_deep_scan_at"] = now.isoformat()
                
            try:
                insforge.table("admin_settings").update(update_data).eq("id", settings["id"]).execute()
            except Exception as e:
                s_logger.warning(f"Heartbeat: Failed to update admin settings timestamp: {e}")
        else:
            s_logger.warning(f"Heartbeat: DataForSEO returned 0 tasks for session {session_id}. NOT updating last_global_scan_at to allow retry.")

        # [FIX 2026-05-01] Wrap in try/except — an unprotected failure here
        # was preventing the critical scan_sessions completion update below.
        try:
            insforge.table("market_heartbeat_logs").update({
                "status": "completed",
                "hotels_count": total,
                "end_time": datetime.now(timezone.utc).isoformat()
            }).eq("session_id", session_id).execute()
        except Exception as hb_log_e:
            s_logger.warning(f"Heartbeat: market_heartbeat_logs update failed (non-fatal): {hb_log_e}")

        try:
            insforge.table("scan_sessions").update({
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", session_id).execute()
        except Exception as upd_e:
            s_logger.warning(f"Heartbeat: Failed to complete scan_sessions: {upd_e}")

        s_logger.info(f"Heartbeat: Successfully submitted {total} tasks for session {session_id}")
        return session_id

    except Exception as e:
        s_logger.error(f"Heartbeat Failure: {e}")
        s_logger.error(traceback.format_exc())
        
        # [FIX 2026-05-01] Use reasoning_trace instead of non-existent error_message column.
        # The previous code silently failed because scan_sessions has no error_message field,
        # leaving the session stuck in 'running' until the zombie reaper killed it 2h later.
        try:
            if 'session_id' in locals():
                insforge.table("scan_sessions").update({
                    "status": "failed",
                    "reasoning_trace": f"Heartbeat crash: {str(e)[:500]}",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", session_id).execute()
        except Exception as inner_e:
            s_logger.warning(f"Heartbeat: Could not update scan_sessions failure status: {inner_e}")


async def process_system_scans(insforge: InsForgeClient, specific_task_id: Optional[str] = None):
    """
    The System Heartbeat Processor. Optimized for Webhook-driven processing.
    Now replaces polling with targeted fetching or recovery logic.
    """
    s_logger = get_scheduler_logger()
    
    # Pre-flight credentials check: Prevents misconfigured environments 
    # (e.g. GitHub Actions without repository secrets) from eagerly fetching, 
    # failing, and poisoning legitimate pending database tasks.
    dfs_login = os.environ.get("DATAFORSEO_LOGIN") or os.environ.get("DATAFORSEO_API_KEY")
    dfs_password = os.environ.get("DATAFORSEO_PASSWORD")
    if not dfs_login or not dfs_password:
        s_logger.warning("Task Processor: DataForSEO credentials not available in this environment. Skipping results collection to prevent task poisoning.")
        return

    try:
        completed_ids = []
        if specific_task_id:
            completed_ids = [specific_task_id]
            s_logger.info(f"Task Processor: Processing targeted task {specific_task_id} (Webhook-driven)")
        else:
            # [2026-05-14] CRITICAL FIX: Orphan Task Recovery Routine
            # Finds tasks that were successfully persisted locally but failed submission 
            # to the external provider (DataForSEO) due to connection drop/restart.
            try:
                s_logger.info("Orphan Recovery: Checking for unsubmitted pending tasks...")
                orphan_res = (
                    insforge.table("scan_tasks")
                    .select(
                        "id, task_type, batch_id, "
                        "batch:scan_batches(session_id), "
                        "hotel:hotels(id, name, location, serp_api_id, property_token, currency, scan_adults, scan_children_ages, latitude, longitude)"
                    )
                    .eq("status", "pending")
                    .is_("external_task_id", "null")
                    .limit(20)
                    .execute()
                )
                
                orphans_raw = orphan_res.data or []
                if orphans_raw:
                    s_logger.info(f"Orphan Recovery: Found {len(orphans_raw)} pending tasks without external IDs.")
                    
                    # Cast raw JSON list items to dictionary format for safe indexing
                    orphans = [cast(dict, o) for o in orphans_raw]
                    
                    # Gather unique session IDs safely
                    session_ids_set = set()
                    for o in orphans:
                        b = cast(dict, o.get("batch")) if o.get("batch") else None
                        if b and b.get("session_id"):
                            session_ids_set.add(b["session_id"])
                    session_ids = list(session_ids_set)
                    
                    session_map = {}
                    if session_ids:
                        sessions_res = (
                            insforge.table("scan_sessions")
                            .select("id, check_in_date, check_out_date, adults, children_ages, currency")
                            .in_("id", session_ids)
                            .execute()
                        )
                        if sessions_res.data:
                            session_map = {cast(dict, s)["id"]: cast(dict, s) for s in sessions_res.data}
                            
                    price_tasks_to_post = []
                    info_tasks_to_post = []
                    
                    for o in orphans:
                        local_task_id = o["id"]
                        task_type = o["task_type"]
                        hotel = cast(dict, o.get("hotel")) if o.get("hotel") else None
                        if not hotel:
                            continue
                            
                        batch = cast(dict, o.get("batch")) if o.get("batch") else None
                        session_id = batch.get("session_id") if batch else None
                        session = cast(dict, session_map.get(session_id)) if session_id else None
                        
                        # Dynamic parameter reconstruction matching submit_hotel_scan_batch logic
                        check_in = session.get("check_in_date") if session and session.get("check_in_date") else (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
                        check_out = session.get("check_out_date") if session and session.get("check_out_date") else (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
                        adults = session.get("adults") if session and session.get("adults") else 2
                        children = session.get("children_ages") if session and session.get("children_ages") else []
                        currency = session.get("currency") if session and session.get("currency") else (hotel.get("currency") or "USD")
                        
                        normalized_loc = dataforseo_provider._normalize_location(hotel.get("location") or "Turkiye")
                        
                        if task_type == "pricing":
                            price_task = {
                                "hotel_identifier": hotel.get("property_token") or hotel.get("serp_api_id"),
                                "keyword": f"{hotel.get('name', '')} {hotel.get('location', '')}".strip(),
                                "location_name": normalized_loc,
                                "language_name": "English",
                                "check_in": check_in,
                                "check_out": check_out,
                                "currency": currency,
                                "tag": local_task_id,  # Tag MUST match scan_tasks UUID
                            }
                            
                            task_adults = adults or hotel.get("scan_adults")
                            task_children = children or hotel.get("scan_children_ages")
                            
                            if task_adults:
                                price_task["adults"] = task_adults
                            if task_children:
                                price_task["children"] = task_children
                            if hotel.get("latitude") and hotel.get("longitude"):
                                price_task["location_coordinate"] = f"{hotel['latitude']},{hotel['longitude']},50"
                                
                            price_tasks_to_post.append(price_task)
                            
                        elif task_type == "hotel_info":
                            keyword = hotel.get("property_token") or hotel.get("serp_api_id") or f"{hotel.get('name', '')} {hotel.get('location', '')}".strip()
                            
                            info_task = {
                                "hotel_identifier": keyword if (hotel.get("serp_api_id") or hotel.get("property_token")) else None,
                                "keyword": None if (hotel.get("serp_api_id") or hotel.get("property_token")) else keyword,
                                "location_name": normalized_loc,
                                "language_name": "English",
                                "check_in": check_in,
                                "check_out": check_out,
                                "currency": currency,
                                "adults": adults,
                                "tag": local_task_id,  # Tag MUST match scan_tasks UUID
                            }
                            task_children = children or hotel.get("scan_children_ages")
                            if task_children:
                                info_task["children"] = task_children
                                
                            info_tasks_to_post.append(info_task)
                            
                    recovered_count = 0
                    if price_tasks_to_post:
                        s_logger.info(f"Orphan Recovery: Posting {len(price_tasks_to_post)} pricing tasks to provider...")
                        posted_prices = await dataforseo_provider.post_price_tasks(price_tasks_to_post)
                        if posted_prices:
                            for pt in posted_prices:
                                if pt.get("status_code") in [20000, 20100]:
                                    task_tag = pt.get("data", {}).get("tag")
                                    ext_id = pt.get("id")
                                    if task_tag and ext_id:
                                        insforge.table("scan_tasks").update({"external_task_id": ext_id}).eq("id", task_tag).execute()
                                        recovered_count += 1
                                        
                    if info_tasks_to_post:
                        s_logger.info(f"Orphan Recovery: Posting {len(info_tasks_to_post)} info tasks to provider...")
                        posted_infos = await dataforseo_provider.post_info_tasks(info_tasks_to_post)
                        if posted_infos:
                            for it in posted_infos:
                                if it.get("status_code") in [20000, 20100]:
                                    task_tag = it.get("data", {}).get("tag")
                                    ext_id = it.get("id")
                                    if task_tag and ext_id:
                                        insforge.table("scan_tasks").update({"external_task_id": ext_id}).eq("id", task_tag).execute()
                                        recovered_count += 1
                                        
                    s_logger.info(f"Orphan Recovery completed: {recovered_count} tasks submitted and linked.")
            except Exception as orphan_err:
                s_logger.error(f"Orphan Recovery encountered an error: {orphan_err}", exc_info=True)

            # [REPLACEMENT] We no longer poll get_completed_tasks() (tasks_ready endpoint).
            # Instead, we rely on webhooks, and use this as a recovery loop for missed tasks.
            s_logger.info("Task Processor: Running recovery check for missed webhooks...")
            
            query = (
                insforge.table("scan_tasks")
                .select("external_task_id, created_at")
                .eq("status", "pending")
                .not_.is_("external_task_id", "null")
            )
            if not getattr(insforge, "_force_heartbeat", False):
                recovery_cutoff = (
                    datetime.now(timezone.utc) - timedelta(minutes=10)
                ).isoformat()
                query = query.lt("created_at", recovery_cutoff)

            pending_res = query.limit(100).execute()


            if pending_res.data:
                completed_ids = [cast(dict, t)["external_task_id"] for t in pending_res.data]
                s_logger.info(
                    f"Task Processor: Added {len(completed_ids)} recovery candidates (>{10}min old)."
                )

        if not completed_ids:
            return

        s_logger.info(
            f"Task Processor: Found {len(completed_ids)} items to process."
        )

        # 2. Extract Task IDs and resolve Metadata in BULK
        task_id_to_metadata = {}  # tag -> {hotel_id, batch_id}
        tags_to_resolve = []
        for tid in completed_ids:
            # We assume tag is the scan_task_id (UUID)
            tags_to_resolve.append(tid)

        if tags_to_resolve:
            # We search for either our internal ID or the provider's task ID
            tags_quoted = [f'"{t}"' for t in tags_to_resolve]
            # [KAIZEN 2026] Included hotel:hotels(name, property_token) for identity verification
            # [FIX 5] Also select task_type for type-aware endpoint routing
            tasks_res = (
                insforge.table("scan_tasks")
                .select(
                    "id, external_task_id, hotel_id, batch_id, task_type, created_at, batch:scan_batches(session_id), hotel:hotels(name, property_token, currency)"
                )
                .or_(
                    f"id.in.({','.join(tags_quoted)}),external_task_id.in.({','.join(tags_quoted)})"
                )
                .execute()
            )

            for t_raw in tasks_res.data or []:
                t = cast(dict, t_raw)
                # Map by both IDs to ensure resolution
                task_id_to_metadata[t["id"]] = t
                if t.get("external_task_id"):
                    task_id_to_metadata[cast(str, t["external_task_id"])] = t

        # Collector Buffer for Batch Processing
        batch_results = []  # List of {hotel_id, result, scan_task_id, batch_id}
        tasks_to_fail = []

        # Parallel fetch for all completed tasks from DataForSEO
        # [KAIZEN 2026] Now passes target_token and target_name to enforce identity-aware extraction
        fetch_tasks = []
        fetched_ids = []  # [FIX 2026-05-04] Track which IDs were actually fetched to prevent index misalignment
        for tid in completed_ids:
            meta = task_id_to_metadata.get(tid)

            # [FIX 2026-04-28] Ensure we have metadata before fetching to prevent identity-less extraction
            # that could lead to data leakage (picking items[0] blindly).
            if not meta:
                s_logger.warning(f"Task Processor: No metadata found for task {tid}. Skipping fetch.")
                continue

            token = None
            name = None
            if meta.get("hotel"):
                hotel_meta = cast(dict, meta["hotel"])
                token = hotel_meta.get("property_token")
                name = hotel_meta.get("name")

            # [FIX 5] Pass task_type for type-aware endpoint routing
            # [KAIZEN 2026] Pass batch_id as session_id for Everything Vault logging
            fetch_tasks.append(
                dataforseo_provider.get_task_result(
                    tid,
                    db=insforge,
                    session_id=cast(dict, meta.get("batch", {})).get("session_id") if meta.get("batch") else None,
                    target_token=token,
                    target_name=name,
                    task_type=meta.get("task_type"),
                )
            )
            fetched_ids.append(tid)  # [FIX 2026-05-04] Only add ID if task was actually submitted

        all_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

        # [FIX 2026-04-19] Track "not ready" tasks separately from real failures
        tasks_not_ready = []
        now_utc = datetime.now(timezone.utc)
        PERMANENT_FAIL_MINUTES = 30  # Only permanently fail after 30 minutes

        persistence = ScanPersistenceService(insforge, admin_insforge=get_insforge_db(admin=True))

        for i, res_tuple in enumerate(all_results):
            tid = fetched_ids[i]  # [FIX 2026-05-04] Use fetched_ids instead of completed_ids
            meta = task_id_to_metadata.get(tid)

            # [FIX 2026-04-26] Unpack 2-tuple (processed_data, raw_json) from provider
            if isinstance(res_tuple, tuple) and len(res_tuple) == 2:
                result, raw_json = res_tuple
            else:
                result, raw_json = res_tuple, None

            if (
                isinstance(result, Exception)
                or not result
                or (isinstance(result, dict) and result.get("status") != "success")
            ):
                if meta:
                    # Check task age before marking as permanent failure
                    task_age_minutes = 0
                    try:
                        if isinstance(meta.get("created_at"), str):
                            created_dt = datetime.fromisoformat(
                                cast(str, meta["created_at"]).replace("Z", "+00:00")
                            )
                            task_age_minutes = (
                                now_utc - created_dt
                            ).total_seconds() / 60
                    except Exception:
                        task_age_minutes = 999  # If we can't parse, assume old

                    # Determine if this is a definitive failure that shouldn't wait for timeout
                    is_definitive_failure = False
                    fail_reason = "unknown"
                    if isinstance(result, dict):
                        fail_reason = result.get("failure_reason", result.get("status", "failed"))
                        if fail_reason in ["identity_mismatch", "invalid_response", "provider_error", "task_error"]:
                            is_definitive_failure = True
                    elif isinstance(result, Exception):
                        fail_reason = "exception"
                        # Optional: Mark certain exceptions as definitive
                    
                    if task_age_minutes >= PERMANENT_FAIL_MINUTES or is_definitive_failure:
                        s_logger.error(
                            f"Task Processor: Failing task {tid} (Reason: {fail_reason}, Age: {task_age_minutes:.0f}min): {result}"
                        )
                        # Attach the reason to meta so we can persist it to the DB
                        meta["error_message"] = str(result.get("message")) if isinstance(result, dict) and result.get("message") else fail_reason
                        tasks_to_fail.append(meta)

                        # [DIAGNOSTIC] Log to Everything Vault for unified error observability
                        try:
                            # Safely extract session_id from the nested meta structure
                            session_id = None
                            if meta.get("batch") and isinstance(meta["batch"], dict):
                                session_id = meta["batch"].get("session_id")
                            
                            await persistence.vault_log(
                                db=persistence.admin_insforge,
                                session_id=str(session_id) if session_id else "",
                                endpoint=f"monitor/fail/{fail_reason}",
                                data={
                                    "task_id": tid,
                                    "hotel_id": meta.get("hotel_id"),
                                    "result": str(result) if not isinstance(result, dict) else result,
                                    "raw_response": raw_json
                                }
                            )
                        except Exception as v_err:
                            s_logger.error(f"Task Processor: Vault logging failed: {v_err}")
                    else:

                        s_logger.info(
                            f"Task Processor: Task {tid} not ready yet (age: {task_age_minutes:.0f}min) — will retry later."
                        )
                        tasks_not_ready.append(meta)
                continue

            tag_raw = result.get("tag", tid) if isinstance(result, dict) else tid
            # If meta wasn't found by tid, try tag_raw
            if not meta:
                meta = task_id_to_metadata.get(tag_raw)

            if not meta:
                continue

            # [FIX 2026-05-17] Extract session_id from batch metadata so price_logs
            # are correctly linked to the scan_session, not to individual task IDs.
            _batch_meta = meta.get("batch")
            _session_id = _batch_meta.get("session_id") if isinstance(_batch_meta, dict) else None

            batch_results.append(
                {
                    "hotel_id": meta["hotel_id"],
                    "result": result,
                    "scan_task_id": meta["id"],
                    "batch_id": meta.get("batch_id"),
                    "session_id": _session_id,
                    "task_type": meta.get("task_type"),  # [FIX 2026-05-10] Forward task_type for OTA protection
                }
            )

        # Process Failures
        if tasks_to_fail:
            from collections import Counter

            # Bulk update status and individual error messages
            # [FIX] We iterate to preserve individual error messages captured in the loop
            for t in tasks_to_fail:
                insforge.table("scan_tasks").update({
                    "status": "failed",
                    "error_message": t.get("error_message", "Unknown error")
                }).eq("id", t["id"]).execute()


            batch_fail_counts = Counter(
                [t["batch_id"] for t in tasks_to_fail if t.get("batch_id")]
            )
            for bid, count in batch_fail_counts.items():
                insforge.rpc(
                    "increment_batch_failures", {"b_id": str(bid), "p_count": count}
                ).execute()
            s_logger.info(
                f"Task Processor: Marked {len(tasks_to_fail)} tasks as failed."
            )

        if batch_results:
            s_logger.info(
                f"Task Processor: Syncing {len(batch_results)} results in vectorized batch..."
            )
            success = await sync_extraction_results_batch(insforge, batch_results)
            if success:
                s_logger.info(
                    f"Task Processor: Successfully synced {len(batch_results)} results."
                )
            else:
                s_logger.error("Task Processor: Batch sync failed.")

    except Exception as e:
        s_logger.error(f"Task Processor General Failure: {e}")


async def _trigger_heartbeat_notifications(
    insforge: InsForgeClient,
    events: List[Dict[str, Any]],
    initiator_id: Optional[UUID] = None,
):
    """
    Optimized Batch Heartbeat Notifications (Fixes N+1 Bug).
    Uses vectorized queries to resolve users, settings, and history in bulk.
    """
    if not events:
        return

    try:
        from backend.agents.notifier_agent import NotifierAgent
        notifier = NotifierAgent(insforge)

        # 1. Identity Resolution & Fetching Involved Users
        hotel_ids = list(set(str(e["hotel_id"]) for e in events))
        
        query = insforge.table("user_hotels").select("user_id, hotel_id, hotels!inner(name, property_token)").eq("is_monitored", True)
        
        if not hotel_ids:
            return

        users_res = query.in_("hotel_id", hotel_ids).execute()
        if not users_res.data:
            return

        # 2. Bulk Fetch Settings & Price History
        user_ids = list(set(cast(dict, u)["user_id"] for u in users_res.data))
        settings_res = insforge.table("settings").select("*").in_("user_id", user_ids).execute()
        settings_map = {str(cast(dict, s)["user_id"]): s for s in settings_res.data}

        # Baseline Fetch: 5-Day Rolling Window
        # We fetch all history for these hotels from exactly 5 days ago
        # This ensures the 30% variance check is based on time, not a random row count.
        from datetime import datetime, timedelta, timezone
        five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)

        history_res = (
            insforge.table("price_logs")
            .select("hotel_id, price, recorded_at")
            .in_("hotel_id", hotel_ids)
            .gte("recorded_at", five_days_ago.isoformat())
            .order("recorded_at", desc=True)
            .execute()
        )
        
        history_map = {}
        for h_raw in (history_res.data or []):
            h = cast(dict, h_raw)
            hid = str(h["hotel_id"])
            if hid not in history_map:
                history_map[hid] = []
            history_map[hid].append(h)

        # 3. Process Events & Generate Alerts
        all_alerts = []
        user_to_alerts = {} # user_id -> {alerts: [], names: {}}

        for event in events:
            hid = str(event["hotel_id"])
            curr_p = float(event.get("price") or 0)
            currency = event.get("currency", "TRY")
            parity_offers = event.get("parity_offers") or []
            token = event.get("property_token")
            
            # Find relevant users for this event and deduplicate by user_id to prevent triplicate/duplicate alerts
            seen_uids = set()
            relevant_users = []
            for u_raw in users_res.data:
                u = cast(dict, u_raw)
                uid = str(u["user_id"])
                if uid in seen_uids:
                    continue
                u_hotels = cast(dict, u.get("hotels", {}))
                if str(u["hotel_id"]) == hid or (token and u_hotels.get("property_token") == token):
                    relevant_users.append(u)
                    seen_uids.add(uid)
            if not relevant_users:
                continue
            
            h_name = cast(dict, relevant_users[0]["hotels"])["name"]
            
            # Parity Analysis
            parity_alert_meta = None
            direct_price = None
            min_ota_price = float("inf")
            lowest_ota = None
            for offer in parity_offers:
                p_val = float(offer.get("price", 0))
                if p_val <= 0:
                    continue
                if offer.get("is_direct"):
                    direct_price = p_val
                elif p_val < min_ota_price:
                    min_ota_price = p_val
                    lowest_ota = offer.get("source", "OTA")

            if direct_price and min_ota_price < (direct_price * 0.99):
                displacement = ((direct_price - min_ota_price) / direct_price) * 100
                parity_alert_meta = {"type": "parity_breach", "displacement": displacement, "culprit": lowest_ota, "ota_p": min_ota_price, "direct_p": direct_price}

            # [KAIZEN 2026] Integrated Anomaly Detection
            # Rely on the flag from persistence for centralized logic
            is_anomaly = event.get("is_anomaly", False)
            
            # Calculate change_pct for display relative to baseline
            change_pct = 0.0
            hist = history_map.get(hid, [])
            recent_valid = [float(h["price"]) for h in hist if float(h.get("price") or 0) > 0 and not h.get("is_anomaly")]
            if recent_valid:
                avg_baseline = sum(recent_valid) / len(recent_valid)
                if avg_baseline > 0:
                    change_pct = ((curr_p - avg_baseline) / avg_baseline) * 100
            else:
                avg_baseline = 0.0

            # Distribute to Users
            for u in relevant_users:
                uid = str(u["user_id"])
                s = cast(Dict[str, Any], settings_map.get(uid))
                if not s or not s.get("notifications_enabled"):
                    continue
                
                is_global = (initiator_id is None) or (str(initiator_id) != uid)
                prefix = "[Pulse] " if is_global else ""
                if is_anomaly:
                    prefix = f"[CRITICAL] {prefix}"

                # Threshold Check (User Defined)
                user_threshold = s.get("threshold_percent", 2.0) if s else 2.0
                if abs(change_pct) >= user_threshold:
                    a_type = "market_pulse" if is_global else ("price_drop" if change_pct < 0 else "price_spike")
                    
                    msg = f"{prefix}{h_name} rate shifted {abs(change_pct):.1f}% to {curr_p} {currency}"
                    if is_anomaly:
                        msg += f" (Baseline: {avg_baseline:.0f})"

                    alert = {
                        "user_id": uid,
                        "hotel_id": hid,
                        "alert_type": a_type,
                        "message": msg,
                        "old_price": round(avg_baseline, 2),
                        "new_price": curr_p,
                        "currency": currency,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "metadata": {
                            "variance": round(change_pct, 2),
                            "is_anomaly": is_anomaly,
                            "baseline": round(avg_baseline, 2)
                        }
                    }
                    all_alerts.append(alert)
                    
                    if uid not in user_to_alerts:
                        user_to_alerts[uid] = {"alerts": [], "names": {}}
                    user_to_alerts[uid]["alerts"].append(alert)
                    user_to_alerts[uid]["names"][hid] = h_name

                # Parity Breach Notification
                if parity_alert_meta:
                    p_alert = {
                        "user_id": uid, 
                        "hotel_id": hid, 
                        "alert_type": "parity_breach", 
                        "message": f"{prefix}Parity Breach: {parity_alert_meta['culprit']} is undercutting {h_name} by {parity_alert_meta['displacement']:.1f}%", 
                        "old_price": parity_alert_meta["direct_p"], 
                        "new_price": parity_alert_meta["ota_p"], 
                        "currency": currency,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "metadata": parity_alert_meta
                    }
                    all_alerts.append(p_alert)
                    if uid not in user_to_alerts:
                        user_to_alerts[uid] = {"alerts": [], "names": {}}
                    user_to_alerts[uid]["alerts"].append(p_alert)
                    user_to_alerts[uid]["names"][hid] = h_name

        # 4. Vectorized Persistence & Dispatch
        if all_alerts:
            insforge.table("alerts").insert(all_alerts).execute()
        
        for uid, data in user_to_alerts.items():
            await notifier.notify(data["alerts"], cast(Dict[str, Any], settings_map[uid]), data["names"])

    except Exception as e:
        logger.error(f"Batch Notifier Failure: {e}")
        logger.error(traceback.format_exc())

async def sync_extraction_result(
    insforge: InsForgeClient,
    hotel_id: str,
    result: Dict[str, Any],
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    source: str = "System",
    task_type: Optional[str] = None,
) -> bool:
    """
    DRY Wrapper for Batch Sync.
    """
    batch_item = {
        "hotel_id": hotel_id,
        "result": result,
        "initiator_id": user_id,
        "scan_task_id": session_id,
        "task_type": task_type
    }
    return await sync_extraction_results_batch(insforge, [batch_item], source=source)

async def sync_extraction_results_batch(
    insforge: InsForgeClient, 
    batch_items: List[Dict[str, Any]], 
    source: str = "System_Monitor_Batch"
) -> bool:
    """
    Orchestrates batch persistence and side effects.
    Delegates all DB operations to ScanPersistenceService.
    """
    from backend.services.scan_persistence import ScanPersistenceService
    from backend.agents.market_intelligence_agent import MarketIntelligenceAgent

    if not batch_items:
        return True

    try:
        # 1. Delegate Persistence
        persistence = ScanPersistenceService(insforge, admin_insforge=get_insforge_db(admin=True))
        sync_result = await persistence.batch_sync_extraction_results(batch_items, source=source)

        notification_events = sync_result.get("notification_events", [])
        analysis_payload = sync_result.get("analysis_payload", [])

        # 2. Batch Notification Trigger
        if notification_events:
            # Check initiator for first item as a proxy for the batch type (system/manual)
            initiator_id = batch_items[0].get("initiator_id")
            await _trigger_heartbeat_notifications(insforge, notification_events, initiator_id=initiator_id)

        # 3. Market Intelligence Briefing
        if analysis_payload:
            try:
                agent = MarketIntelligenceAgent()
                await agent.analyze_market_batch(insforge, analysis_payload)
            except Exception as e:
                logger.error(f"Batch Sync: Market Analysis failed: {e}")

        return True

    except Exception as e:
        logger.error(f"CRITICAL: Batch Sync Failure: {e}")
        logger.error(traceback.format_exc())
        return False





if __name__ == "__main__":
    # CLI Test Mode: Usage: export PYTHONPATH=$PYTHONPATH:. && python3 backend/services/monitor_service.py
    import asyncio

    print("Starting manual scheduler check...")
    asyncio.run(run_scheduler_check_logic())
    print("Check complete. See scheduler.log for details.")
