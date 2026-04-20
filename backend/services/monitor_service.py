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
from uuid import UUID

from backend.models.schemas import SCAN_PULSE_INTERVAL_HOURS
from backend.services.location_service import LocationService
from backend.services.providers.dataforseo_provider import dataforseo_provider
from backend.services.scan_persistence import ScanPersistenceService
from backend.utils.db import get_supabase
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)


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
    status_detail: Optional[str] = None,
):
    """
    Logs a system event (pulse or mesh activity) to query_logs for feed visibility.
    """
    try:
        res = (
            db.table("query_logs")
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


async def run_scheduler_check_logic(db: Optional[Client] = None):
    """
    Main entry point for the autonomous scheduler.
    Performs heartbeat checks, data processing, and cleanup.
    """
    s_logger = get_scheduler_logger()
    s_logger.info("CRON: Starting scheduler check...")

    supabase = db or get_supabase(admin=True)
    if not supabase:
        s_logger.error("CRON: Could not initialize Supabase.")
        return

    # 0. RESOLVE UNRECOGNIZED LOCATIONS
    # This pre-scan phase maps human-readable hotel locations to DataForSEO location_codes.
    try:
        loc_service = LocationService(supabase)
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
        # REMOVED: next_scan_at is deprecated

        # 1.5 RUN SYSTEM HEARTBEAT (New Global 4h Standard)
        # This function handles its own timing checks via admin_settings table.
        try:
            await run_system_heartbeat(supabase)
        except Exception as h_e:
            s_logger.error(f"CRON: Heartbeat submission error: {h_e}")

        # 2. PROCESS COMPLETED TASKS (DataForSEO result collector)
        # Always run this as a safety net for webhooks.
        try:
            await process_system_scans(supabase)
        except Exception as s_e:
            s_logger.error(f"CRON: Result collection error: {s_e}")

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
                    supabase.rpc("increment_batch_failures", {"b_id": b_id}).execute()
        except Exception as z_e:
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
                s_logger.info(
                    "CRON: Triggering global market intelligence sync (Eyes of Turkey)..."
                )

                sync_session = (
                    supabase.table("scan_sessions")
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

                tobb = TOBBScraper(supabase)
                tga = TGAScraper(supabase)

                tobb_res = await tobb.scrape_to_supabase()
                tga_res = await tga.scrape_to_supabase()

                status = (
                    "completed"
                    if (
                        tobb_res.get("status") == "success"
                        and tga_res.get("status") == "success"
                    )
                    else "partial"
                )

                if sync_id:
                    supabase.table("scan_sessions").update(
                        {
                            "status": status,
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
        # EXPLANATION OF FIX:
        # Previously, there was a timezone mismatch because InsForge returns timestamps
        # ending with "Z" (e.g. 2026-04-19T13:42:51Z), and Python's datetime.fromisoformat()
        # in standard libraries prior to 3.11 doesn't parse 'Z' natively.
        # We explicitly replace 'Z' with '+00:00' to ensure it converts properly into a
        # timezone-aware UTC datetime. This prevents false positive overlap checks which
        # previously caused the system to skip scheduled background scans.
        is_due = True
        if last_scan:
            try:
                last_dt = datetime.fromisoformat(last_scan.replace("Z", "+00:00"))
                if (now - last_dt).total_seconds() < (interval * 3600):
                    is_due = False
            except Exception:
                is_due = True

        if not is_due and not getattr(db, "_force_heartbeat", False):
            return

        s_logger.info(
            f"Heartbeat: Global system scan starting (Interval: {interval}h)..."
        )

        # 3. Fetch all unique monitored hotels
        # 1. Update Admin Settings immediately (Optimistic Locking)
        # This prevents the 5-minute scheduler loop from retrying if this execution is slow.
        next_scan = now + timedelta(hours=interval)
        try:
            db.table("admin_settings").update(
                {
                    "last_global_scan_at": now.isoformat(),
                    "next_global_scan_at": next_scan.isoformat(),
                }
            ).eq("id", settings["id"]).execute()
        except Exception as e:
            s_logger.warning(
                f"Heartbeat: Failed to update admin settings timestamp (pre-submission): {e}"
            )

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
        criteria_groups = {}  # token -> [list_of_ids]
        criteria_data = {}  # token -> hotel_metadata

        for item in monitored_res.data:
            h = item.get("hotels")
            if not h:
                continue

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
            s_logger.info(
                "Heartbeat: No valid monitored hotels found after deduplication."
            )
            return

        s_logger.info(
            f"Heartbeat: Submitting {len(criteria_groups)} unique search tasks (from {len(monitored_res.data)} monitored records)..."
        )

        # 4. Use the optimized batch submission logic
        target_hotel_ids = [h_ids[0] for h_ids in criteria_groups.values()]

        check_in = date.today().strftime("%Y-%m-%d")
        check_out = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")

        # Construct Pingback URL
        api_domain = os.environ.get("API_BACKEND_DOMAIN") or os.environ.get(
            "VERCEL_DOMAIN"
        )
        pingback_url = None
        if api_domain:
            pingback_url = f"https://{api_domain}/api/hotel-webhook"
            source = (
                "API_BACKEND_DOMAIN"
                if os.environ.get("API_BACKEND_DOMAIN")
                else "VERCEL_DOMAIN"
            )
            s_logger.info(
                f"Heartbeat: Using explicit pingback_url ({source}): {pingback_url}"
            )

        success_count = await dataforseo_provider.submit_hotel_scan_batch(
            db=db,
            hotel_ids=target_hotel_ids,
            check_in=check_in,
            check_out=check_out,
            batch_type="scheduled_pulse",
            deep_scan=True,
            pingback_url=pingback_url,
        )

        s_logger.info(
            f"Heartbeat: Successfully posted {success_count}/{len(target_hotel_ids)} tracking units."
        )

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

        # [RECOVERY] If tasks_ready is skipping some, check old pending tasks directly
        # [FIX 2026-04-19] Only attempt recovery on tasks older than 3 minutes
        # to avoid race condition where freshly submitted tasks get permanently failed
        recovery_cutoff = (
            datetime.now(timezone.utc) - timedelta(minutes=3)
        ).isoformat()
        pending_res = (
            db.table("scan_tasks")
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
                db.table("scan_tasks")
                .select(
                    "id, external_task_id, hotel_id, batch_id, task_type, created_at, hotel:hotels(name, property_token)"
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
            db.table("scan_tasks").update({"status": "failed"}).in_(
                "id", fail_task_ids
            ).execute()

            batch_fail_counts = Counter(
                [t["batch_id"] for t in tasks_to_fail if t.get("batch_id")]
            )
            for bid, count in batch_fail_counts.items():
                db.rpc(
                    "increment_batch_failures", {"b_id": str(bid), "p_count": count}
                ).execute()
            s_logger.info(
                f"Task Processor: Marked {len(tasks_to_fail)} tasks as failed."
            )

        if batch_results:
            s_logger.info(
                f"Task Processor: Syncing {len(batch_results)} results in vectorized batch..."
            )
            success = await sync_extraction_results_batch(db, batch_results)
            if success:
                s_logger.info(
                    f"Task Processor: Successfully synced {len(batch_results)} results."
                )
            else:
                s_logger.error("Task Processor: Batch sync failed.")

    except Exception as e:
        s_logger.error(f"Task Processor General Failure: {e}")


async def _trigger_heartbeat_notifications(
    db: Client,
    hotel_id: str,
    current_price: float,
    currency: str,
    parity_offers: Optional[List[Dict]] = None,
    initiator_id: Optional[UUID] = None,
):
    """
    Finds all users monitoring this hotel and triggers alerts if price drops/changes.
    If initiator_id is provided, those alerts are marked as 'market_pulse' for others.
    """
    try:
        from backend.agents.notifier_agent import NotifierAgent

        notifier = NotifierAgent()

        # 1. Find all users who monitor this hotel
        query = (
            db.table("user_hotels")
            .select("user_id, hotel_id, hotels(name, property_token)")
            .eq("hotel_id", hotel_id)
            .eq("is_monitored", True)
        )
        users_res = query.execute()
        if not users_res.data:
            return

        hotel_data = users_res.data[0].get("hotels", {})
        hotel_name = hotel_data.get("name", "Unknown Hotel")

        # 2. For each user, check their individual threshold
        user_ids = [u["user_id"] for u in users_res.data]
        settings_res = (
            db.table("settings").select("*").in_("user_id", user_ids).execute()
        )
        settings_map = {str(s["user_id"]): s for s in settings_res.data}

        # 3. Detect Parity Breach / OTA Overcut
        parity_alert = None
        if parity_offers:
            # Find direct price and lowest OTA
            direct_price = None
            lowest_ota = None
            min_ota_price = float("inf")

            for offer in parity_offers:
                is_direct = offer.get("is_direct", False)
                price_val = float(offer.get("price", 0))
                if price_val <= 0:
                    continue

                if is_direct:
                    direct_price = price_val
                else:
                    if price_val < min_ota_price:
                        min_ota_price = price_val
                        lowest_ota = offer.get("source", "OTA")

            # If OTA is undercutting direct rate (by > 1% to avoid noise)
            if direct_price and min_ota_price < (direct_price * 0.99):
                displacement = ((direct_price - min_ota_price) / direct_price) * 100
                parity_alert = {
                    "alert_type": "parity_breach",
                    "displacement": displacement,
                    "culprit": lowest_ota,
                    "ota_price": min_ota_price,
                    "direct_price": direct_price,
                }
            elif not direct_price and min_ota_price < (current_price * 0.95):
                # If we don't have a direct flag but OTA is 5% lower than 'primary' detected price
                displacement = ((current_price - min_ota_price) / current_price) * 100
                parity_alert = {
                    "alert_type": "ota_overcut",
                    "displacement": displacement,
                    "culprit": lowest_ota,
                    "ota_price": min_ota_price,
                    "direct_price": current_price,
                }

        # 4. Get price history for baseline comparison
        history_res = (
            db.table("price_logs")
            .select("price")
            .eq("hotel_id", hotel_id)
            .order("recorded_at", desc=True)
            .limit(2)
            .execute()
        )

        if len(history_res.data) < 2:
            return

        prev_price = float(history_res.data[1]["price"])
        change_pct = ((current_price - prev_price) / max(prev_price, 1)) * 100

        # 5. Create ONE master Global Pulse record (user_id = None)
        # This ensures the public 100-hotel feed is populated even if no user monitors it.
        if abs(change_pct) > 0.1 or parity_alert:
            pulse_type = "market_pulse"
            if parity_alert:
                pulse_msg = f"Global Pulse: Parity Breach detected for {hotel_name} at ${parity_alert['ota_price']} (Direct: ${parity_alert['direct_price']})"
            else:
                pulse_msg = f"Global Pulse: {hotel_name} price shifted {abs(change_pct):.1f}% to {current_price} {currency}"

            db.table("alerts").insert(
                {
                    "user_id": None,
                    "hotel_id": hotel_id,
                    "alert_type": pulse_type,
                    "message": pulse_msg,
                    "old_price": prev_price,
                    "new_price": current_price,
                    "currency": currency,
                    "is_global_pulse": True,
                }
            ).execute()

        # 6. For each user, check their individual threshold
        for user_id_str in user_ids:
            user_id = UUID(user_id_str)
            settings = settings_map.get(user_id_str)
            if not settings or not settings.get("notifications_enabled"):
                continue

            threshold = settings.get("threshold_percent", 2.0)

            # Determine Global Pulse Status (applicable to all alert types)
            # System Heartbeat (initiator_id is None) OR cross-user notification
            is_global = (initiator_id is None) or (str(initiator_id) != user_id_str)
            prefix = "Global Pulse: " if is_global else ""

            # A. Handle Price Shift Alert
            if abs(change_pct) >= threshold:
                # If triggered by someone else OR system, it's a pulse
                if is_global and (initiator_id is not None):
                    alert_type = "market_pulse"
                else:
                    alert_type = "price_drop" if change_pct < 0 else "price_spike"

                alert_msg = f"{prefix}{hotel_name} rate shifted {abs(change_pct):.1f}% to {current_price} {currency}"

                alert_res = (
                    db.table("alerts")
                    .insert(
                        {
                            "user_id": str(user_id),
                            "hotel_id": hotel_id,
                            "alert_type": alert_type,
                            "message": alert_msg,
                            "old_price": prev_price,
                            "new_price": current_price,
                            "currency": currency,
                            "is_global_pulse": is_global,
                        }
                    )
                    .execute()
                )

                # Dispatch notification
                if alert_res.data:
                    await notifier.dispatch_alerts(
                        [alert_res.data[0]], settings, {hotel_id: hotel_name}
                    )

            # B. Handle Parity Breach Alert (Independent of threshold_percent)
            if parity_alert:
                parity_msg = f"{prefix}Parity Breach: {parity_alert['culprit']} is undercutting {hotel_name} by {parity_alert['displacement']:.1f}% (${parity_alert['ota_price']} vs ${parity_alert['direct_price']})"

                p_alert_res = (
                    db.table("alerts")
                    .insert(
                        {
                            "user_id": str(user_id),
                            "hotel_id": hotel_id,
                            "alert_type": parity_alert["alert_type"],
                            "message": parity_msg,
                            "old_price": parity_alert["direct_price"],
                            "new_price": parity_alert["ota_price"],
                            "currency": currency,
                            "is_global_pulse": is_global,
                            "metadata": {
                                "culprit": parity_alert["culprit"],
                                "displacement": parity_alert["displacement"],
                            },
                        }
                    )
                    .execute()
                )

                if p_alert_res.data:
                    await notifier.dispatch_alerts(
                        [p_alert_res.data[0]], settings, {hotel_id: hotel_name}
                    )

    except Exception as e:
        logger.error(f"Heartbeat Notifier Error for hotel {hotel_id}: {e}")


async def sync_extraction_result(
    db: Client,
    hotel_id: str,
    result: Dict[str, Any],
    scan_task_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    source: str = "System",
):
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
                db.table("scan_tasks").update(
                    {"status": "failed", "error_message": "Invalid price"}
                ).eq("id", scan_task_id).execute()
                if batch_id:
                    db.rpc("increment_batch_failures", {"b_id": batch_id}).execute()
            return False

        # 2. Get hotel variation context
        primary_res = (
            db.table("hotels")
            .select("id, name, location, property_token")
            .eq("id", hotel_id)
            .single()
            .execute()
        )
        if not primary_res.data:
            logger.warning(f"Sync: Hotel {hotel_id} not found.")
            return False

        hotel_ref = primary_res.data
        prop_token = hotel_ref.get("property_token")
        h_name = hotel_ref["name"]
        h_location = hotel_ref["location"]

        # 3. Find variations sharing the same identity
        if prop_token:
            matching_hotels = (
                db.table("hotels")
                .select("id")
                .eq("property_token", prop_token)
                .execute()
            )
        else:
            matching_hotels = (
                db.table("hotels")
                .select("id")
                .eq("name", h_name)
                .eq("location", h_location)
                .execute()
            )

        target_ids = (
            [h["id"] for h in matching_hotels.data]
            if matching_hotels.data
            else [hotel_id]
        )

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
                source=source,
            )

            # 5. Trigger Notifications (Heartbeat)
            await _trigger_heartbeat_notifications(
                db,
                target_id,
                float(price),
                currency,
                parity_offers=result.get("parity_offers") or result.get("offers"),
            )

        # 7. Update Task/Batch status
        if scan_task_id:
            db.table("scan_tasks").update({"status": "completed"}).eq(
                "id", scan_task_id
            ).execute()
            if batch_id:
                db.rpc("increment_batch_success", {"b_id": batch_id}).execute()

        return True

    except Exception as e:
        logger.error(f"Sync Failure: {e}")
        if scan_task_id:
            try:
                db.table("scan_tasks").update(
                    {"status": "failed", "error_message": str(e)}
                ).eq("id", scan_task_id).execute()
                if batch_id:
                    db.rpc("increment_batch_failures", {"b_id": batch_id}).execute()
            except Exception:
                pass
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
        hotel_data_map = {}  # hotel_id -> {merged_result, task_ids[]}
        raw_archives = []  # List of {id, raw_results} for bulk update
        completed_task_ids = [
            item["scan_task_id"] for item in batch_items if item.get("scan_task_id")
        ]

        for item in batch_items:
            hid = str(item["hotel_id"])
            h_ids.append(hid)

            res = item.get("result", {})
            if not res or res.get("status") != "success":
                continue

            # Store Raw JSON for archival
            if item.get("scan_task_id") and res.get("raw_data"):
                raw_archives.append(
                    {"id": item["scan_task_id"], "raw_results": res["raw_data"]}
                )

            if hid not in hotel_data_map:
                hotel_data_map[hid] = {
                    "res": res,
                    "task_ids": [item.get("scan_task_id")],
                }
            else:
                # [FIX 4] Smart merge logic: NEVER let price=0 overwrite a valid positive price
                existing = hotel_data_map[hid]["res"]
                merged = existing.copy()
                for key, val in res.items():
                    if key == "price":
                        # Only upgrade price: keep the highest positive price
                        new_price = float(val) if val else 0
                        old_price = float(merged.get("price", 0) or 0)
                        if new_price > 0 and new_price > old_price:
                            merged[key] = new_price
                        # else: keep existing (never downgrade to 0)
                    elif val and (
                        not merged.get(key)
                        or (
                            isinstance(val, list)
                            and len(val) > len(merged.get(key, []))
                        )
                    ):
                        merged[key] = val

                hotel_data_map[hid]["res"] = merged
                hotel_data_map[hid]["task_ids"].append(item.get("scan_task_id"))

        # 2. Bulk Fetch Hotel Context (Tokens/Metadata)
        hotels_res = (
            db.table("hotels")
            .select("id, name, location, property_token")
            .in_("id", h_ids)
            .execute()
        )
        if not hotels_res.data:
            logger.warning(f"Batch Sync: No hotel records found for IDs {h_ids}")
            return False

        logger.info(f"Batch Sync: Found {len(hotels_res.data)} hotels for sync.")
        hotel_lookup = {str(h["id"]): h for h in hotels_res.data}
        tokens = list(
            set(
                [
                    h["property_token"]
                    for h in hotels_res.data
                    if h.get("property_token")
                ]
            )
        )

        # 3. Find all variations sharing same tokens/names
        variations_res = []
        if tokens:
            v_res = (
                db.table("hotels")
                .select("id, property_token, name, location")
                .in_("property_token", tokens)
                .execute()
            )
            variations_res = v_res.data or []

        # 4. Prepare Bulk Updates
        hotel_updates = []
        price_logs = []
        persistence = ScanPersistenceService(db, admin_db=get_supabase(admin=True))

        now_ts = datetime.now(timezone.utc).isoformat()
        processed_variations = set()

        for hid, h_data in hotel_data_map.items():
            h_ref = hotel_lookup.get(hid)
            if not h_ref:
                continue

            res_data = h_data["res"]
            price = float(res_data.get("price") or 0)
            currency = res_data.get("currency", "TRY")

            # Identify all targets for this specific result (primary + variations)
            token = h_ref.get("property_token")
            targets = (
                [v for v in variations_res if v.get("property_token") == token]
                if token
                else [h_ref]
            )

            for target in targets:
                target_id = target["id"]
                if target_id in processed_variations:
                    continue
                processed_variations.add(target_id)

                # [FIX 6] Only include current_price if we have a real positive number
                # This prevents hotel_info-only results from zeroing out valid prices
                upd = {
                    "id": target_id,
                    "name": target.get("name"),
                    "location": target.get("location"),
                    "last_scanned_at": now_ts,
                }
                if price > 0:
                    upd["current_price"] = price

                # Map all available metadata from merged results
                if res_data.get("rating"):
                    upd["rating"] = res_data.get("rating")
                if res_data.get("stars"):
                    upd["stars"] = res_data.get("stars")
                if res_data.get("reviews"):
                    upd["review_count"] = res_data.get("reviews")
                if res_data.get("reviews_count"):
                    upd["review_count"] = res_data.get("reviews_count")
                if res_data.get("description"):
                    upd["description"] = res_data.get("description")
                if res_data.get("amenities"):
                    upd["amenities"] = res_data.get("amenities")
                if res_data.get("check_in_time"):
                    upd["check_in_time"] = res_data.get("check_in_time")
                if res_data.get("check_out_time"):
                    upd["check_out_time"] = res_data.get("check_out_time")
                if res_data.get("sentiment_breakdown"):
                    upd["sentiment_breakdown"] = res_data.get("sentiment_breakdown")
                if res_data.get("latitude"):
                    upd["latitude"] = res_data.get("latitude")
                if res_data.get("longitude"):
                    upd["longitude"] = res_data.get("longitude")
                if res_data.get("phone"):
                    upd["phone"] = res_data.get("phone")
                if res_data.get("website"):
                    upd["website"] = res_data.get("website")
                if res_data.get("address"):
                    upd["address"] = res_data.get("address")
                if res_data.get("image_url"):
                    upd["image_url"] = res_data.get("image_url")
                if res_data.get("rating_distribution"):
                    upd["rating_distribution"] = res_data.get("rating_distribution")

                # Rich data: room_types from room_catalog names or ota_prices room info
                room_types = res_data.get("room_types") or []
                room_catalog = res_data.get("room_catalog") or []
                if room_catalog:
                    upd["room_types"] = room_catalog  # Full room catalog with prices
                elif room_types:
                    upd["room_types"] = room_types

                # Guest mentions (raw review sentiment mentions)
                if res_data.get("guest_mentions"):
                    upd["guest_mentions"] = res_data.get("guest_mentions")

                # Reviews column: store other_sites_reviews + OTA summary
                reviews_data = {}
                if res_data.get("other_sites_reviews"):
                    reviews_data["other_sites_reviews"] = res_data[
                        "other_sites_reviews"
                    ]
                if res_data.get("ota_prices"):
                    reviews_data["ota_count"] = len(res_data["ota_prices"])
                    reviews_data["ota_min_price"] = min(
                        (p.get("price") or 9999999) for p in res_data["ota_prices"]
                    )
                    reviews_data["ota_sources"] = [
                        p.get("source")
                        for p in res_data["ota_prices"]
                        if p.get("source")
                    ]
                if reviews_data:
                    upd["reviews"] = reviews_data

                # Images
                if res_data.get("images"):
                    upd["images"] = res_data["images"]

                hotel_updates.append(upd)

                # Price Log Entry — only log if we have a real positive price
                if price > 0:
                    # Build OTA offers for price log
                    ota_offers = res_data.get("ota_prices") or []

                    price_logs.append(
                        {
                            "hotel_id": target_id,
                            "price": price,
                            "currency": currency,
                            "parity_offers": ota_offers
                            if ota_offers
                            else (
                                res_data.get("parity_offers")
                                or res_data.get("offers", [])
                            ),
                            "market_offers": res_data.get("all_prices")
                            or res_data.get("market_offers", []),
                            "room_types": room_catalog if room_catalog else room_types,
                            "recorded_at": now_ts,
                            "source": "DataForSEO_Batch",
                        }
                    )

                # Sentiment History
                if res_data.get("sentiment_breakdown"):
                    sentiment_history.append(
                        {
                            "hotel_id": target_id,
                            "rating": res_data.get("rating"),
                            "review_count": res_data.get("reviews")
                            or res_data.get("reviews_count"),
                            "sentiment_breakdown": res_data.get("sentiment_breakdown"),
                            "recorded_at": now_ts,
                        }
                    )

        # 5. Execute Bulk DB Operations
        if hotel_updates:
            db.table("hotels").upsert(hotel_updates).execute()
            logger.info(f"Batch Sync: Updated {len(hotel_updates)} hotel records.")

        if price_logs:
            # Use upsert to handle potential duplicates based on unique constraints
            res = db.table("price_logs").upsert(price_logs).execute()
            if hasattr(res, "error") and res.error:
                logger.warning(f"Batch Sync: Price log persistence failed: {res.error}")
            else:
                logger.info(
                    f"Batch Sync: Persisted {len(price_logs)} price history logs."
                )

        if sentiment_history:
            db.table("sentiment_history").insert(sentiment_history).execute()
            logger.info(
                f"Batch Sync: Inserted {len(sentiment_history)} sentiment history entries."
            )

        # 6. Update Task Statuses
        if completed_task_ids:
            # Perform atomic status update
            db.table("scan_tasks").update({"status": "completed"}).in_(
                "id", completed_task_ids
            ).execute()

            # Perform bulk archival of raw results
            if raw_archives:
                db.table("scan_tasks").upsert(raw_archives).execute()
                logger.info(
                    f"Batch Sync: Archived {len(raw_archives)} raw result documents."
                )

            # Update batch progress using RPC with correct counts
            from collections import Counter

            batch_counts = Counter(
                [item["batch_id"] for item in batch_items if item.get("batch_id")]
            )
            for bid, count in batch_counts.items():
                try:
                    db.rpc(
                        "increment_batch_success", {"b_id": str(bid), "p_count": count}
                    ).execute()
                except Exception as rpc_err:
                    logger.warning(
                        f"Batch Sync: RPC increment_batch_success failed for {bid}: {rpc_err}"
                    )

        # 7. [VECTORIZED] Concurrently trigger room catalog updates and notification checks
        persistence = ScanPersistenceService(db, admin_db=get_supabase(admin=True))
        post_sync_tasks = []

        # Prepare Batch Catalog Sync
        scraper_results_for_catalog = []
        for hid, h_data in hotel_data_map.items():
            res_data = h_data["res"]
            rooms = res_data.get("room_types", [])
            if rooms:
                scraper_results_for_catalog.append(
                    {"hotel_id": hid, "room_types": rooms}
                )

        if scraper_results_for_catalog:
            hotels_context = list(hotel_lookup.values())
            # Use high-performance vectorized batch update
            post_sync_tasks.append(
                persistence.batch_update_room_type_catalog(
                    scraper_results_for_catalog, hotels_context
                )
            )

        # Individual Notification Checks
        for hid, h_data in hotel_data_map.items():
            h_ref = hotel_lookup.get(hid)
            res_data = h_data["res"]
            if h_ref:
                price = float(res_data.get("price", 0))
                currency = res_data.get("currency", "TRY")
                if price > 0:
                    post_sync_tasks.append(
                        _trigger_heartbeat_notifications(
                            db,
                            hid,
                            price,
                            currency,
                            parity_offers=res_data.get("parity_offers")
                            or res_data.get("offers"),
                        )
                    )

        if post_sync_tasks:
            # We use return_exceptions=True to ensure one failure doesn't stop others
            await asyncio.gather(*post_sync_tasks, return_exceptions=True)
            logger.info(
                f"Batch Sync: Completed {len(post_sync_tasks)} post-sync operations (rooms/notifs)."
            )

        # 8. GENERATE MARKET INTELLIGENCE BRIEFING
        # Collect results for AI analysis
        try:
            import uuid

            from backend.agents.market_intelligence_agent import MarketIntelligenceAgent

            agent = MarketIntelligenceAgent()
            analysis_results = []
            analysis_hotel_ids = []

            for hid, h_data in hotel_data_map.items():
                h_ref = hotel_lookup.get(hid)
                if h_ref:
                    res_copy = h_data["res"].copy()
                    res_copy["hotel_id"] = hid
                    res_copy["hotel_name"] = h_ref.get("name")
                    res_copy["hotel_location"] = h_ref.get("location")
                    analysis_results.append(res_copy)
                    analysis_hotel_ids.append(hid)

            if analysis_results:
                logger.info(
                    f"Batch Sync: Triggering Agentic Intelligence for {len(analysis_results)} hotel updates..."
                )
                intelligence = await agent.run_analysis(analysis_results)

                report_title = f"System Market Briefing - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                db.table("reports").insert(
                    {
                        "id": str(uuid.uuid4()),
                        "title": report_title,
                        "report_type": "briefing",
                        "hotel_ids": analysis_hotel_ids,
                        "report_data": intelligence,  # Stores {analysis, trace}
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).execute()
                logger.info(
                    f"Batch Sync: Successfully saved Agentic Briefing: {report_title}"
                )
        except Exception as ai_e:
            logger.error(f"Batch Sync: Agentic Reporting failed: {ai_e}")

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
