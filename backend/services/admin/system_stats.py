"""
Admin — System Statistics & Health Metrics
============================================
Handles system-wide stats, provider health checks, heartbeat metrics,
system log tailing, and scheduler queue monitoring.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

import os
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from uuid import UUID

from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.models.schemas import (
    AdminSettings,
    AdminSettingsUpdate,
    AdminStats,
    HealthMetrics,
    ProviderHealth,
    ScanVolume,
    SystemLogEntry,
    SystemLogsResponse,
)
from backend.services.provider_factory import ProviderFactory
from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_admin_stats_logic(db: Client) -> AdminStats:
    """Get system-wide statistics."""
    try:
        # Count Users (approx via settings or profiles)
        users_count = (
            db.table("settings").select("user_id", count="exact").execute().count or 0
        )

        # Count Hotels
        hotels_count = (
            db.table("hotels").select("id", count="exact").execute().count or 0
        )

        # Count Scans
        scans_count = (
            db.table("scan_sessions").select("id", count="exact").execute().count or 0
        )

        # Count Directory
        directory_count = (
            db.table("hotel_directory").select("id", count="exact").execute().count or 0
        )

        # API Calls (Today)
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        api_calls = 0
        recent_scans = (
            db.table("scan_sessions")
            .select("hotels_count")
            .gte("created_at", today_start.isoformat())
            .execute()
        )
        if recent_scans.data:
            api_calls = sum(s.get("hotels_count", 0) for s in recent_scans.data)

        # Scraper Health (Last 24h)
        # Calculate health as the percentage of successful or partially successful
        # scans over the last 24 hours. This allows administrators to quickly
        # identify if an external provider (like DataForSEO) is experiencing global issues.
        last_24h = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent_sessions_health = (
            db.table("scan_sessions")
            .select("status, created_at, completed_at")
            .gte("created_at", last_24h)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        health = 100.0
        avg_latency = 0.0
        error_rate = 0.0

        if recent_sessions_health.data:
            total_recent = len(recent_sessions_health.data)
            successes = sum(
                1
                for s in recent_sessions_health.data
                if s["status"] in ["completed", "partial"]
            )
            health = (successes / total_recent) * 100
            error_rate = ((total_recent - successes) / total_recent) * 100

            # Calculate Latency for successful scans
            durations = []
            for s in recent_sessions_health.data:
                if (
                    s["status"] in ["completed", "partial"]
                    and s.get("created_at")
                    and s.get("completed_at")
                ):
                    try:
                        start = datetime.fromisoformat(
                            s["created_at"].replace("Z", "+00:00")
                        )
                        end = datetime.fromisoformat(
                            s["completed_at"].replace("Z", "+00:00")
                        )
                        durations.append((end - start).total_seconds() * 1000)
                    except ValueError:
                        logger.debug("Skipped malformed timestamp in scan latency calc")

            if durations:
                avg_latency = sum(durations) / len(durations)

        return AdminStats(
            total_users=users_count,
            total_hotels=hotels_count,
            total_scans=scans_count,
            api_calls_today=api_calls,
            directory_size=directory_count,
            scraper_health=round(health, 1),
            avg_latency_ms=round(avg_latency, 1),
            error_rate_24h=round(error_rate, 1),
            active_nodes=int(os.getenv("NODE_COUNT", 1)),
            service_role_active="SUPABASE_SERVICE_ROLE_KEY" in os.environ,
        )
    except PostgRESTError as e:
        logger.error(f"PostgREST error in admin stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Data mapping error in admin stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Stats data error: {e}")


async def get_admin_providers_logic() -> List[Dict[str, Any]]:
    """
    Fetch status of registered network providers.

    EXPLANATION: Admin Providers
    Returns a list of configured providers (e.g. DataForSEO) with their
    status and priority. Used by ApiKeysPanel to show 'Network Providers'.
    """
    try:
        return ProviderFactory.get_status_report()
    except (AttributeError, ImportError) as e:
        logger.error(f"Provider factory error: {e}", exc_info=True)
        return []


async def get_system_logs_logic(limit: int = 100) -> SystemLogsResponse:
    """
    Efficiently tail the scheduler.log file to get the last N lines.
    Uses collections.deque to avoid reading the entire file into memory.
    """
    # Active log path — is actually in the project root according to current deployment
    # Align with project root for consistency
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    log_path = os.path.join(project_root, "scheduler.log")
    
    if not os.path.exists(log_path):
        # Graceful fallback: Check backend/logs/scheduler.log as well
        alt_path = os.path.join(project_root, "backend", "logs", "scheduler.log")
        if os.path.exists(alt_path):
            log_path = alt_path
        else:
            return SystemLogsResponse(
                logs=[SystemLogEntry(line="[System Error] No log file found at expected locations.", level="ERROR", line_num=0)],
                total_lines=0,
                file_path=log_path
            )

    try:
        # Memory-efficient: deque(f, maxlen=limit) iterates over the file handle
        # and only keeps the last N lines in memory.
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            last_lines = deque(f, maxlen=limit)

        logs = []
        for i, line in enumerate(last_lines):
            clean_line = line.strip()
            if not clean_line:
                continue

            level = "INFO"
            if "ERROR" in clean_line:
                level = "ERROR"
            elif "WARN" in clean_line:
                level = "WARN"
            elif "SUCCESS" in clean_line:
                level = "SUCCESS"

            logs.append(SystemLogEntry(line=clean_line, level=level, line_num=i))

        return SystemLogsResponse(
            logs=logs,
            total_lines=len(logs),
            file_path=log_path
        )
    except FileNotFoundError:
        logger.warning(f"Log file not found at {log_path}")
        return SystemLogsResponse(
            logs=[SystemLogEntry(line="[System Error] Log file disappeared.", level="ERROR", line_num=0)],
            total_lines=0,
            file_path=log_path
        )
    except PermissionError:
        logger.error(f"Permission denied reading log file at {log_path}")
        return SystemLogsResponse(
            logs=[SystemLogEntry(line="[System Error] Permission denied for log file.", level="ERROR", line_num=0)],
            total_lines=0,
            file_path=log_path
        )
    except OSError as e:
        logger.error(f"OS error reading system logs: {e}", exc_info=True)
        return SystemLogsResponse(
            logs=[SystemLogEntry(line=f"[System Error] OS error: {e}", level="ERROR", line_num=0)],
            total_lines=0,
            file_path=log_path
        )


async def get_admin_market_heartbeats_logic(db: Client) -> HealthMetrics:
    """
    Retrieves real-time system health metrics using market_heartbeat_logs
    and scan_batches.
    """
    try:
        # 1. Get Maintenance Mode
        settings_res = (
            db.table("admin_settings").select("maintenance_mode").limit(1).execute()
        )
        is_maintenance = (
            settings_res.data[0].get("maintenance_mode", False)
            if settings_res.data
            else False
        )

        # 2. Get 24h Heartbeat Logs
        last_24h = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        heartbeat_logs = (
            db.table("market_heartbeat_logs")
            .select("*")
            .gte("start_time", last_24h)
            .order("start_time", desc=True)
            .execute()
        )

        if not heartbeat_logs.data:
            return HealthMetrics(
                overall_status="maintenance" if is_maintenance else "operational",
                uptime_24h=100.0,
                avg_latency=0.0,
                active_nodes=0,
                last_heartbeat=None,
                provider_health=[],
                scan_volume=[],
            )

        # 3. Aggregations
        total_logs = len(heartbeat_logs.data)
        completed_logs = sum(
            1 for log in heartbeat_logs.data if log.get("status") == "completed"
        )
        uptime_24h = (completed_logs / total_logs * 100) if total_logs > 0 else 100.0

        # 4. Latency Calculation (Last 10 completed)
        completed_heartbeats = [
            log
            for log in heartbeat_logs.data
            if log.get("status") == "completed" and log.get("end_time")
        ]
        latencies = []
        for log in completed_heartbeats[:10]:
            try:
                start = datetime.fromisoformat(log["start_time"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(log["end_time"].replace("Z", "+00:00"))
                latencies.append((end - start).total_seconds())
            except (ValueError, KeyError):
                logger.debug("Skipped malformed timestamp in heartbeat latency calc")
                continue
        avg_latency = (sum(latencies) / len(latencies)) if latencies else 0.0

        # 5. Provider Health (Dynamic via check_health)
        provider_health = []
        active_providers = ProviderFactory.get_active_providers()

        # Calculate success rate from recent batches for context
        session_ids = [
            log["session_id"] for log in heartbeat_logs.data if log.get("session_id")
        ]
        batch_success_rates = {}
        last_batch_times = {}

        global_success_rate = 100.0
        if session_ids:
            batches_res = (
                db.table("scan_batches")
                .select("success_count, fail_count, session_id, updated_at")
                .in_("session_id", session_ids)
                .execute()
            )

            if batches_res.data:
                tot_success = sum(b.get("success_count", 0) for b in batches_res.data)
                tot_fail = sum(b.get("fail_count", 0) for b in batches_res.data)
                tot_calls = tot_success + tot_fail
                global_success_rate = (
                    (tot_success / tot_calls * 100) if tot_calls > 0 else 100.0
                )

                last_time = None
                try:
                    last_time = datetime.fromisoformat(
                        batches_res.data[0]["updated_at"].replace("Z", "+00:00")
                    )
                except (ValueError, KeyError, IndexError):
                    pass

                # Assign metrics to providers
                for p in active_providers:
                    p_name = p.get_provider_name()
                    batch_success_rates[p_name] = global_success_rate
                    last_batch_times[p_name] = last_time

        for provider in active_providers:
            p_name = provider.get_provider_name()
            try:
                # Perform real-time health check (API call to provider)
                health_res = await provider.check_health()
                status = "online" if health_res["status"] == "healthy" else "offline"
            except (ConnectionError, TimeoutError, OSError) as e:
                logger.warning(f"Network error during health check for {p_name}: {e}")
                status = "offline"
            except (KeyError, TypeError) as e:
                logger.warning(f"Malformed health response from {p_name}: {e}")
                status = "offline"

            s_rate = batch_success_rates.get(p_name, 100.0)
            l_call = last_batch_times.get(p_name, datetime.now(timezone.utc))

            # Degrade status if success rate is low
            if status == "online" and s_rate < 80:
                status = "degraded"

            provider_health.append(
                ProviderHealth(
                    name=p_name,
                    status=status,
                    last_call=l_call,
                    success_rate=round(s_rate, 2),
                )
            )

        # 6. Scan Volume (Hourly bins)
        scan_volume_map = {}
        for log in heartbeat_logs.data:
            try:
                dt = datetime.fromisoformat(log["start_time"].replace("Z", "+00:00"))
                hour_key = dt.replace(minute=0, second=0, microsecond=0)
                scan_volume_map[hour_key] = scan_volume_map.get(hour_key, 0) + (
                    log.get("hotels_count") or 0
                )
            except (ValueError, KeyError):
                continue

        scan_volume = [
            ScanVolume(timestamp=k, count=v)
            for k, v in sorted(scan_volume_map.items())
        ]

        # 7. Status Determination
        overall_status = "operational"
        if is_maintenance:
            overall_status = "maintenance"
        elif uptime_24h < 90 or global_success_rate < 80:
            overall_status = "degraded"

        last_heartbeat = None
        if heartbeat_logs.data:
            try:
                last_heartbeat = datetime.fromisoformat(
                    heartbeat_logs.data[0]["start_time"].replace("Z", "+00:00")
                )
            except (ValueError, KeyError):
                pass

        # Active nodes: unique trigger sources in the last 4 hours
        four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=4)
        active_nodes_set = set()
        for log in heartbeat_logs.data:
            trigger = log.get("trigger_source")
            if trigger:
                try:
                    log_time = datetime.fromisoformat(log["start_time"].replace("Z", "+00:00"))
                    if log_time > four_hours_ago:
                        active_nodes_set.add(trigger)
                except (ValueError, KeyError):
                    continue
        active_nodes_count = len(active_nodes_set)

        return HealthMetrics(
            overall_status=overall_status,
            uptime_24h=round(uptime_24h, 2),
            avg_latency=round(avg_latency, 2),
            active_nodes=max(1, active_nodes_count),
            last_heartbeat=last_heartbeat,
            provider_health=provider_health,
            scan_volume=scan_volume,
        )

    except PostgRESTError as e:
        logger.error(f"PostgREST error in heartbeat logic: {e}", exc_info=True)
        return HealthMetrics(
            overall_status="degraded",
            uptime_24h=0.0,
            avg_latency=0.0,
            active_nodes=0,
            last_heartbeat=None,
            provider_health=[],
            scan_volume=[],
        )
    except (KeyError, TypeError) as e:
        logger.error(f"Data mapping error in heartbeat logic: {e}", exc_info=True)
        return HealthMetrics(
            overall_status="degraded",
            uptime_24h=0.0,
            avg_latency=0.0,
            active_nodes=0,
            last_heartbeat=None,
            provider_health=[],
            scan_volume=[],
        )


async def get_scheduler_queue_logic(db: Client) -> List[Dict[str, Any]]:
    """
    Fetch status of the pulse queue.
    Shows users and their proximity to the next 4-hour heartbeat.
    """
    try:
        from backend.services.monitor_service import MONITOR_PULSE_HOURS

        datetime.now(timezone.utc)

        # 1. Fetch all profiles
        profiles_res = db.table("profiles").select("id").execute()
        profiles = profiles_res.data or []
        if not profiles:
            return []

        user_ids = [p["id"] for p in profiles]

        # 2. Fetch display names
        names_res = (
            db.table("user_profiles")
            .select("user_id, display_name, email")
            .in_("user_id", user_ids)
            .execute()
        )
        names_map = {
            n["user_id"]: n.get("display_name") or n.get("email", "Unknown")
            for n in (names_res.data or [])
        }

        # 3. Fetch hotel mapping
        mapping_res = (
            db.table("user_hotels")
            .select("user_id, hotel_id")
            .in_("user_id", user_ids)
            .execute()
        )
        hotel_counts = {}
        for m in mapping_res.data or []:
            uid = m["user_id"]
            hotel_counts[uid] = hotel_counts.get(uid, 0) + 1

        queue = []
        for p in profiles:
            uid = p["id"]

            status = "active" if hotel_counts.get(uid, 0) > 0 else "inactive"

            queue.append(
                {
                    "user_id": uid,
                    "user_name": names_map.get(uid, "Unknown"),
                    "pulse_interval_hours": MONITOR_PULSE_HOURS,
                    "status": status,
                    "hotel_count": hotel_counts.get(uid, 0),
                }
            )

        queue.sort(key=lambda x: x["hotel_count"], reverse=True)
        return queue
    except ImportError as e:
        logger.error(f"Failed to import monitor_service: {e}")
        return []
    except PostgRESTError as e:
        logger.error(f"PostgREST error in scheduler queue: {e}", exc_info=True)
        return []
    except (KeyError, TypeError) as e:
        logger.warning(f"Data error in scheduler queue: {e}")
        return []


async def trigger_all_overdue_logic() -> Dict[str, Any]:
    """
    Manually triggers the background scheduler loop.
    Finds all users who are currently due/overdue and triggers their scans.
    """
    try:
        from backend.services.monitor_service import run_scheduler_check_logic

        await run_scheduler_check_logic()
        return {
            "status": "success",
            "message": "All overdue scans triggered successfully.",
        }
    except ImportError as e:
        logger.error(f"Failed to import scheduler: {e}")
        return {"error": "Scheduler module not available"}
    except PostgRESTError as e:
        logger.error(f"PostgREST error triggering overdue scans: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except (RuntimeError, ConnectionError) as e:
        logger.error(f"Runtime error triggering overdue scans: {e}", exc_info=True)
        return {"error": str(e)}


async def get_admin_settings_logic(db: Client) -> AdminSettings:
    """Fetch global application settings."""
    try:
        res = db.table("admin_settings").select("*").limit(1).execute()
        if res.data:
            return AdminSettings(**res.data[0])
    except PostgRESTError as e:
        logger.warning(f"Admin settings DB query failed, returning defaults: {e}")
    except (KeyError, TypeError) as e:
        logger.warning(f"Admin settings data error, returning defaults: {e}")

    return AdminSettings(
        id=UUID("00000000-0000-0000-0000-000000000000"),
        maintenance_mode=False,
        signup_enabled=True,
        default_currency="USD",
        updated_at=datetime.now(timezone.utc),
    )


async def update_admin_settings_logic(
    updates: AdminSettingsUpdate, db: Client
) -> AdminSettings:
    """Update global application settings via upsert."""
    try:
        current = await get_admin_settings_logic(db)
        update_data = updates.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        data_to_upsert = {**current.model_dump(), **update_data, "id": str(current.id)}
        res = db.table("admin_settings").upsert(data_to_upsert).execute()
        return (
            AdminSettings(**res.data[0])
            if res.data
            else current.model_copy(update=update_data)
        )
    except PostgRESTError as e:
        logger.error(f"PostgREST error updating admin settings: {e}", exc_info=True)
        raise HTTPException(500, f"Database error updating settings: {e}")
    except (KeyError, TypeError, ValueError) as e:
        logger.error(f"Data error updating admin settings: {e}", exc_info=True)
        raise HTTPException(500, f"Settings update data error: {e}")
