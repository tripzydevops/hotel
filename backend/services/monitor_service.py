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
from typing import Any, Dict, List, Optional
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
        # postgrest-py execute() returns an object that might have 'error' populated
        # but doesn't necessarily raise an exception.
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
            # 3.1. Cleanup sessions (2-hour cutoff)
            zombie_cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=2)
            ).isoformat()
            zombies = (
                insforge.table("scan_sessions")
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
                insforge.table("scan_sessions").update(
                    {
                        "status": "failed",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).in_("id", z_ids).execute()

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
                st_ids = [tk["id"] for tk in stale_tasks.data]
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
                            tk["batch_id"]
                            for tk in stale_tasks.data
                            if tk.get("batch_id")
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

                sync_id = sync_session.data[0]["id"] if sync_session.data else None

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
                    total_events = tobb_res.get("processed", 0) + tga_res.get("processed", 0)
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
    try:
        # 1. Fetch Admin Settings
        settings_res = insforge.table("admin_settings").select("*").limit(1).execute()
        if not settings_res.data:
            s_logger.warning("Heartbeat: No admin settings found. Skipping.")
            return

        settings = settings_res.data[0]
        interval = settings.get("scan_interval_hours", SCAN_PULSE_INTERVAL_HOURS)
        currency = settings.get("default_currency", "TRY")
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

        if not is_due and not getattr(insforge, "_force_heartbeat", False):
            return

        s_logger.info(f"Heartbeat: Global system scan starting (Interval: {interval}h)...")

        # 3. Get monitored hotels first (to set explicit count in initial log)
        monitored_res = (
            insforge.table("user_hotels")
            .select("hotel_id, preferred_currency, hotels(id, name, location, property_token, serp_api_id, location_code, latitude, longitude, currency)")
            .eq("is_monitored", True)
            .execute()
        )
        
        # Deduplicate
        hotels_to_scan = []
        seen_hotels = set()
        if monitored_res.data:
            for item in monitored_res.data:
                h = item.get("hotels")
                pref_currency = item.get("preferred_currency")
                if h:
                    # [AGENT_FIX] Prioritize preferred_currency from user_hotels, 
                    # fallback to hotels.currency if not set. This ensures 
                    # DataForSEO receives the requested currency.
                    if pref_currency:
                        h["currency"] = pref_currency
                    
                    if h.get("id") not in seen_hotels:
                        hotels_to_scan.append(h)
                        seen_hotels.add(h.get("id"))

        # 4. Create Monitoring Session
        session_id = str(uuid.uuid4())
        try:
            # 2. Record Heartbeat Start
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
                "hotels_count": len(hotels_to_scan)
            }).execute()
        except Exception as sle:
            s_logger.error(f"Heartbeat: Failed to record session start: {sle}")

        if not hotels_to_scan:
            s_logger.info("Scheduler: No monitored hotels found.")
            insforge.table("market_heartbeat_logs").update({
                "status": "completed", 
                "end_time": datetime.now(timezone.utc).isoformat()
            }).eq("session_id", session_id).execute()
            return

        # 4. Update Admin Settings immediately
        next_scan = now + timedelta(hours=interval)
        try:
            insforge.table("admin_settings").update({
                "last_global_scan_at": now.isoformat(),
                "next_global_scan_at": next_scan.isoformat(),
            }).eq("id", settings["id"]).execute()
        except Exception as e:
            s_logger.warning(f"Heartbeat: Failed to update admin settings timestamp: {e}")


        # 6. Submit to DataForSEO
        total = await dataforseo_provider.submit_hotel_scan_batch(
            insforge,
            hotels=hotels_to_scan,
            check_in=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
            check_out=(now + timedelta(days=2)).strftime("%Y-%m-%d"),
            deep_scan=False,
            session_id=session_id,
            currency=currency
        )

        insforge.table("market_heartbeat_logs").update({
            "status": "completed",
            "hotels_count": total,
            "end_time": datetime.now(timezone.utc).isoformat()
        }).eq("session_id", session_id).execute()

        s_logger.info(f"Heartbeat: Successfully submitted {total} tasks for session {session_id}")
        return total

    except Exception as e:
        s_logger.error(f"Heartbeat Failure: {e}")
        s_logger.error(traceback.format_exc())


async def process_system_scans(insforge: InsForgeClient):
    """
    The System Heartbeat Processor. Optimized for Batch Syncing.
    """
    s_logger = get_scheduler_logger()
    try:
        # 1. Get completed task IDs
        completed_ids = await dataforseo_provider.get_completed_tasks()

        # [RECOVERY] If tasks_ready is skipping some, check old pending tasks directly
        # [FIX 2026-04-19] Only attempt recovery on tasks older than 3 minutes
        # to avoid race condition where freshly submitted tasks get permanently failed
        recovery_cutoff = (
            datetime.now(timezone.utc) - timedelta(minutes=3)
        ).isoformat()
        pending_res = (
            insforge.table("scan_tasks")
            .select("external_task_id, created_at")
            .eq("status", "pending")
            .not_.is_("external_task_id", "null")
            .lt("created_at", recovery_cutoff)
            .limit(100)
            .execute()
        )

        if pending_res.data:
            pending_external_ids = [t["external_task_id"] for t in pending_res.data]
            # Merge with completed_ids (de-duplicate)
            completed_ids = list(set(completed_ids + pending_external_ids))
            s_logger.info(
                f"Task Processor: Added {len(pending_external_ids)} recovery candidates (>{3}min old)."
            )

        if not completed_ids:
            return

        s_logger.info(
            f"Task Processor: Found {len(completed_ids)} items to check (including recovery candidates)."
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
                    "id, external_task_id, hotel_id, batch_id, task_type, created_at, hotel:hotels(name, property_token, currency)"
                )
                .or_(
                    f"id.in.({','.join(tags_quoted)}),external_task_id.in.({','.join(tags_quoted)})"
                )
                .execute()
            )

            for t in tasks_res.data or []:
                # Map by both IDs to ensure resolution
                task_id_to_metadata[t["id"]] = t
                if t.get("external_task_id"):
                    task_id_to_metadata[t["external_task_id"]] = t

        # Collector Buffer for Batch Processing
        batch_results = []  # List of {hotel_id, result, scan_task_id, batch_id}
        tasks_to_fail = []

        # Parallel fetch for all completed tasks from DataForSEO
        # [KAIZEN 2026] Now passes target_token and target_name to enforce identity-aware extraction
        fetch_tasks = []
        for tid in completed_ids:
            meta = task_id_to_metadata.get(tid)
            token = None
            name = None
            if meta and meta.get("hotel"):
                token = meta["hotel"].get("property_token")
                name = meta["hotel"].get("name")

            # [FIX 5] Pass task_type for type-aware endpoint routing
            fetch_tasks.append(
                dataforseo_provider.get_task_result(
                    tid,
                    target_token=token,
                    target_name=name,
                    task_type=meta.get("task_type") if meta else None,
                )
            )

        all_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

        # [FIX 2026-04-19] Track "not ready" tasks separately from real failures
        tasks_not_ready = []
        now_utc = datetime.now(timezone.utc)
        PERMANENT_FAIL_MINUTES = 30  # Only permanently fail after 30 minutes

        for i, result in enumerate(all_results):
            tid = completed_ids[i]
            meta = task_id_to_metadata.get(tid)

            if (
                isinstance(result, Exception)
                or not result
                or result.get("status") != "success"
            ):
                if meta:
                    # Check task age before marking as permanent failure
                    meta.get("created_at") or meta.get("id")  # fallback
                    task_age_minutes = 0
                    try:
                        if isinstance(meta.get("created_at"), str):
                            created_dt = datetime.fromisoformat(
                                meta["created_at"].replace("Z", "+00:00")
                            )
                            task_age_minutes = (
                                now_utc - created_dt
                            ).total_seconds() / 60
                    except Exception:
                        task_age_minutes = 999  # If we can't parse, assume old

                    if task_age_minutes >= PERMANENT_FAIL_MINUTES:
                        s_logger.error(
                            f"Task Processor: Permanently failing stale task {tid} (age: {task_age_minutes:.0f}min): {result}"
                        )
                        tasks_to_fail.append(meta)
                    else:
                        s_logger.info(
                            f"Task Processor: Task {tid} not ready yet (age: {task_age_minutes:.0f}min) — will retry later."
                        )
                        tasks_not_ready.append(meta)
                continue

            tag_raw = result.get("tag", tid)  # Fallback to tid if tag missing
            # If meta wasn't found by tid, try tag_raw
            if not meta:
                meta = task_id_to_metadata.get(tag_raw)

            if not meta:
                continue

            batch_results.append(
                {
                    "hotel_id": meta["hotel_id"],
                    "result": result,
                    "scan_task_id": meta["id"],
                    "batch_id": meta.get("batch_id"),
                }
            )

        # Process Failures
        if tasks_to_fail:
            from collections import Counter

            fail_task_ids = [t["id"] for t in tasks_to_fail]
            insforge.table("scan_tasks").update({"status": "failed"}).in_(
                "id", fail_task_ids
            ).execute()

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
        property_tokens = list(set(e["property_token"] for e in events if e.get("property_token")))
        hotel_ids = list(set(str(e["hotel_id"]) for e in events))
        
        query = insforge.table("user_hotels").select("user_id, hotel_id, hotels!inner(name, property_token)").eq("is_monitored", True)
        
        if not hotel_ids:
            return

        users_res = query.in_("hotel_id", hotel_ids).execute()
        if not users_res.data:
            return

        # 2. Bulk Fetch Settings & Price History
        user_ids = list(set(u["user_id"] for u in users_res.data))
        settings_res = insforge.table("settings").select("*").in_("user_id", user_ids).execute()
        settings_map = {str(s["user_id"]): s for s in settings_res.data}

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
        for h in (history_res.data or []):
            hid = str(h["hotel_id"])
            if hid not in history_map: history_map[hid] = []
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
            
            # Find relevant users for this event
            relevant_users = [
                u for u in users_res.data 
                if str(u["hotel_id"]) == hid or (token and u["hotels"].get("property_token") == token)
            ]
            if not relevant_users: continue
            
            h_name = relevant_users[0]["hotels"]["name"]
            
            # Parity Analysis
            parity_alert_meta = None
            direct_price = None
            min_ota_price = float("inf")
            lowest_ota = None
            for offer in parity_offers:
                p_val = float(offer.get("price", 0))
                if p_val <= 0: continue
                if offer.get("is_direct"): direct_price = p_val
                elif p_val < min_ota_price:
                    min_ota_price = p_val
                    lowest_ota = offer.get("source", "OTA")

            if direct_price and min_ota_price < (direct_price * 0.99):
                displacement = ((direct_price - min_ota_price) / direct_price) * 100
                parity_alert_meta = {"type": "parity_breach", "displacement": displacement, "culprit": lowest_ota, "ota_p": min_ota_price, "direct_p": direct_price}

            # Price Shift Baseline
            hist = history_map.get(hid, [])
            prev_p = None
            # Find first different price as baseline
            for h_entry in hist:
                p_val = float(h_entry["price"])
                if p_val != curr_p:
                    prev_p = p_val
                    break
            
            change_pct = ((curr_p - prev_p) / max(prev_p, 1)) * 100 if prev_p else 0

            # Distribute to Users
            for u in relevant_users:
                uid = str(u["user_id"])
                s = settings_map.get(uid)
                if not s or not s.get("notifications_enabled"): continue
                
                is_global = (initiator_id is None) or (str(initiator_id) != uid)
                prefix = "[Pulse] " if is_global else ""
                
                # Threshold Check
                if abs(change_pct) >= s.get("threshold_percent", 2.0):
                    a_type = "market_pulse" if is_global else ("price_drop" if change_pct < 0 else "price_spike")
                    alert = {
                        "user_id": uid, 
                        "hotel_id": hid, 
                        "alert_type": a_type, 
                        "message": f"{prefix}{h_name} rate shifted {abs(change_pct):.1f}% to {curr_p} {currency}", 
                        "old_price": prev_p, 
                        "new_price": curr_p, 
                        "currency": currency,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    all_alerts.append(alert)
                    if uid not in user_to_alerts: user_to_alerts[uid] = {"alerts": [], "names": {}}
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
                    if uid not in user_to_alerts: user_to_alerts[uid] = {"alerts": [], "names": {}}
                    user_to_alerts[uid]["alerts"].append(p_alert)
                    user_to_alerts[uid]["names"][hid] = h_name

        # 4. Vectorized Persistence & Dispatch
        if all_alerts:
            insforge.table("alerts").insert(all_alerts).execute()
        
        for uid, data in user_to_alerts.items():
            await notifier.dispatch_alerts(data["alerts"], settings_map[uid], data["names"])

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
) -> bool:
    """
    DRY Wrapper for Batch Sync.
    """
    batch_item = {
        "hotel_id": hotel_id,
        "result": result,
        "initiator_id": user_id,
        "scan_task_id": session_id
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

    if not batch_items: return True

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
