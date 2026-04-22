"""
Admin Service.
Handles system-wide operations, manual directory syncs, user administration,
and system-level reporting.
"""

import csv
import io
import os
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
import pandas as pd
from collections import deque

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse

from backend.models.schemas import (
    AdminDirectoryEntry,
    AdminLog,
    AdminSettings,
    AdminSettingsUpdate,
    AdminStats,
    AdminUser,
    AdminUserCreate,
    AdminUserUpdate,
    PlanCreate,
    PlanUpdate,
    HealthMetrics,
    ProviderHealth,
    ScanVolume,
    SystemLogEntry,
    SystemLogsResponse,
)
from supabase import Client


async def search_admin_directory_logic(db: Client, q: str) -> List[Dict[str, Any]]:
    """
    Search directory with admin privileges.
    """
    try:
        res = db.table("hotel_directory").select("*").ilike("name", f"%{q}%").execute()
        return res.data or []
    except Exception as e:
        print(f"Admin: Directory search failure: {e}")
        return []


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
        # identify if an external provider (like SerpApi) is experiencing global issues.
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
                    except Exception:
                        pass

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
    except Exception as e:
        print(f"Admin Stats Error: {e}")
        raise HTTPException(status_code=500, detail=f"Admin Data Error: {str(e)}")


# get_api_key_status_logic was removed as we migrated to DataForSEO


async def get_admin_providers_logic() -> List[Dict[str, Any]]:
    """
    Fetch status of registered network providers.

    EXPLANATION: Admin Providers
    Returns a list of configured providers (e.g. SerpApi, RapidAPI) with their
    status and priority. Used by ApiKeysPanel to show 'Network Providers'.
    """
    try:
        from backend.services.provider_factory import ProviderFactory

        return ProviderFactory.get_status_report()
    except Exception as e:
        print(f"Admin Providers Error: {e}")
        return []


# Key rotation/reset/reload logic moved to ProviderFactory level or removed


async def admin_update_user_logic(
    user_id: UUID, updates: AdminUserUpdate, db: Client
) -> Dict[str, Any]:
    """Admin: Update user details including schedule and settings."""
    try:
        user_id_str = str(user_id)
        # 1. Update Profile Fields
        profile_fields = {}
        if updates.display_name is not None:
            profile_fields["display_name"] = updates.display_name
        if updates.company_name is not None:
            profile_fields["company_name"] = updates.company_name
        if updates.job_title is not None:
            profile_fields["job_title"] = updates.job_title
        if updates.phone is not None:
            profile_fields["phone"] = updates.phone
        if updates.timezone is not None:
            profile_fields["timezone"] = updates.timezone
        if updates.plan_type is not None:
            profile_fields["plan_type"] = updates.plan_type
        if updates.subscription_status is not None:
            profile_fields["subscription_status"] = updates.subscription_status
        if updates.is_verified is not None:
            profile_fields["is_verified"] = updates.is_verified

        if profile_fields:
            db.table("user_profiles").update(profile_fields).eq(
                "user_id", user_id_str
            ).execute()
            if "plan_type" in profile_fields or "subscription_status" in profile_fields:
                sub_update = {
                    k: v
                    for k, v in profile_fields.items()
                    if k in ["plan_type", "subscription_status"]
                }
                db.table("profiles").update(sub_update).eq("id", user_id_str).execute()

        # 2. Update Settings Fields

        # 3. Update Auth Fields (Requires Admin Bypass)
        from backend.utils.db import get_supabase_client

        admin_db = get_supabase_client(admin=True)
        if admin_db:
            try:
                auth_updates = {}
                if updates.email:
                    auth_updates["email"] = updates.email
                if updates.password:
                    auth_updates["password"] = updates.password
                if auth_updates:
                    # KAİZEN: Handle cases where user might not exist in Auth but exists in profiles
                    admin_db.auth.admin.update_user_by_id(user_id_str, auth_updates)
            except Exception as auth_err:
                print(
                    f"[Admin] Auth-side update skipped or failed for {user_id_str}: {auth_err}"
                )
                # We don't raise here because profile/settings might have succeeded

        return {"status": "success", "message": "User updated successfully"}
    except Exception as e:
        print(f"Admin Update User Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_admin_users_logic(db: Client, q: Optional[str] = None) -> List[AdminUser]:
    """
    Fetch all users with enriched metadata (hotel/scan counts, plans).
    Supports optional search query 'q'.
    """
    try:
        # 1. Fetch profiles based on search query
        query = db.table("user_profiles").select("*")
        if q:
            # Multi-field search using OR logic
            # Note: ilike is used for PostgreSQL case-insensitive search
            query = query.or_(
                f"email.ilike.%{q}%,display_name.ilike.%{q}%,company_name.ilike.%{q}%"
            )

        profiles_res = query.execute()
        profiles_data = profiles_res.data or []

        # profiles_res = db.table("user_profiles").select("*").execute()

        sub_res = (
            db.table("profiles").select("id, plan_type, subscription_status").execute()
        )
        sub_map = {s["id"]: s for s in (sub_res.data or [])}

        users_map = {}
        for p in profiles_data:
            uid = str(p["user_id"])
            if uid not in users_map:
                users_map[uid] = {
                    "id": uid,
                    "email": p.get("email") or "Unknown",
                    "display_name": p.get("display_name"),
                    "company_name": p.get("company_name"),
                    "job_title": p.get("job_title"),
                    "phone": p.get("phone"),
                    "timezone": p.get("timezone"),
                    "is_verified": p.get("is_verified", False),
                    "created_at": p.get("created_at") or datetime.now().isoformat(),
                }

            sub_data = sub_map.get(uid, {})
            users_map[uid]["plan_type"] = (
                sub_data.get("plan_type") or p.get("plan_type") or "trial"
            )
            users_map[uid]["subscription_status"] = (
                sub_data.get("subscription_status")
                or p.get("subscription_status")
                or "trial"
            )

        final_users = []
        for uid, udata in users_map.items():
            try:
                # Optimized count: Hotels this user is MAPPED to
                h_count = (
                    db.table("user_hotels")
                    .select("id", count="exact")
                    .eq("user_id", uid)
                    .execute()
                    .count
                    # Logic is correct, count is what we want
                    or 0
                )
                s_count = (
                    db.table("scan_sessions")
                    .select("id", count="exact")
                    .eq("user_id", uid)
                    .execute()
                    .count
                    or 0
                )
                udata["hotel_count"] = h_count
                udata["scan_count"] = s_count

                # EXPLANATION: Plan-Based Quota Logic
                from backend.services.subscription import SubscriptionService

                access = await SubscriptionService.get_user_limits(db, udata)
                udata["max_hotels"] = access.get("limits", {}).get("hotel_limit", 5)

                final_users.append(AdminUser(**udata))
            except Exception:
                udata["max_hotels"] = 5  # Absolute fallback
                final_users.append(AdminUser(**udata))

        return final_users
    except Exception as e:
        print(f"Admin Users Failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")


async def create_admin_user_logic(user: AdminUserCreate, db: Client) -> Dict[str, Any]:
    """
    Manually create a user in Supabase Auth and User Profiles.
    Requires SERVICE_ROLE_KEY.
    """
    from backend.utils.db import get_supabase_client

    admin_db = get_supabase_client(admin=True)
    if not admin_db:
        raise HTTPException(
            status_code=500, detail="Admin credentials missing or unreachable"
        )
    try:
        res = admin_db.auth.admin.create_user(
            {"email": user.email, "password": user.password, "email_confirm": True}
        )
        new_user = res.user
        if not new_user:
            raise HTTPException(
                status_code=400, detail="Supabase Auth rejected creation"
            )

        # 2. Add Profile
        admin_db.table("user_profiles").insert(
            {
                "user_id": str(new_user.id),
                "display_name": user.display_name or user.email.split("@")[0],
                "email": user.email,
                "plan_type": user.plan_type,
                "subscription_status": user.subscription_status,
                "is_verified": user.is_verified
                if user.is_verified is not None
                else True,
            }
        ).execute()

        # 3. Add to Profiles (for subscription lookup)
        now = datetime.now(timezone.utc)
        trial_end = (now + timedelta(days=15)).isoformat().replace("+00:00", "Z")
        admin_db.table("profiles").insert(
            {
                "id": str(new_user.id),
                "plan_type": user.plan_type,
                "subscription_status": user.subscription_status,
                "current_period_end": trial_end
                if user.subscription_status == "trial"
                else None,
            }
        ).execute()

        # 4. Add default Settings
        admin_db.table("settings").insert(
            {
                "user_id": str(new_user.id),
                "threshold_percent": 2.0,
                "notifications_enabled": True,
                "push_enabled": False,
                "currency": "TRY",
                "dynamic_threshold_enabled": False,
                "dynamic_threshold_sensitivity": 1.0,
            }
        ).execute()

        return {"status": "success", "user_id": str(new_user.id)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def delete_admin_user_logic(user_id: str, db: Client) -> Dict[str, Any]:
    """
    Delete a user and cascade delete their data.
    """
    from backend.utils.db import get_supabase_client

    admin_db = get_supabase_client(admin=True)
    if not admin_db:
        raise HTTPException(
            status_code=500, detail="Admin credentials missing or unreachable"
        )
    tables = [
        "hotels",
        "scan_sessions",
        "user_profiles",
        "settings",
        "notifications",
        "reports",
    ]
    for table in tables:
        try:
            admin_db.table(table).delete().eq("user_id", str(user_id)).execute()
        except Exception:
            pass

    try:
        admin_db.auth.admin.delete_user(str(user_id))
    except Exception:
        pass

    return {"status": "success"}


async def get_admin_logs_logic(db: Client, limit: int = 50) -> List[AdminLog]:
    """
    Fetch recent system activity logs.
    """
    try:
        result = (
            db.table("scan_sessions")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        logs = []
        for session in result.data or []:
            level = "INFO"
            if session["status"] == "failed":
                level = "ERROR"
            elif session["status"] == "completed":
                level = "SUCCESS"

            logs.append(
                AdminLog(
                    id=session["id"],
                    timestamp=session["created_at"],
                    level=level,
                    action=f"Scan Session ({session['session_type']})",
                    details=f"Checked {session.get('hotels_count', 0)} hotels",
                    user_id=session["user_id"],
                )
            )
        return logs
    except Exception:
        return []


async def get_system_logs_logic(limit: int = 100) -> SystemLogsResponse:
    """
    Efficiently tail the scheduler.log file to get the last N lines.
    Uses collections.deque to avoid reading the entire file into memory.
    """
    log_path = os.path.join(os.getcwd(), "scheduler.log")
    if not os.path.exists(log_path):
        return SystemLogsResponse(
            logs=[SystemLogEntry(line="[System] No log file found.", level="WARN", line_num=0)],
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
    except Exception as e:
        return SystemLogsResponse(
            logs=[SystemLogEntry(line=f"[System Error] Failed to read logs: {str(e)}", level="ERROR", line_num=0)],
            total_lines=0,
            file_path=log_path
        )


async def get_admin_directory_logic(
    db: Client, limit: int = 100, city: Optional[str] = None
) -> List[AdminDirectoryEntry]:
    """List directory entries."""
    query = (
        db.table("hotel_directory")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if city:
        query = query.ilike("location", f"%{city}%")
    result = query.execute()
    entries = []
    for item in result.data or []:
        entries.append(
            AdminDirectoryEntry(
                id=item["id"],
                name=item["name"],
                location=item["location"] or "Unknown",
                property_token=item.get("property_token"),
                created_at=item["created_at"],
            )
        )
    return entries


async def add_admin_directory_entry_logic(entry: dict, db: Client) -> Dict[str, Any]:
    """Add a directory entry manually."""
    try:
        db.table("hotel_directory").insert(
            {
                "name": entry["name"],
                "location": entry["location"],
                "property_token": entry.get("property_token"),
            }
        ).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def delete_admin_directory_logic(entry_id: str, db: Client) -> Dict[str, Any]:
    """Delete a directory entry."""
    try:
        db.table("hotel_directory").delete().eq("id", entry_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def update_admin_directory_logic(
    entry_id: str, updates: dict, db: Client
) -> Dict[str, Any]:
    """Update a directory entry."""
    try:
        update_data = {
            k: v
            for k, v in updates.items()
            if k in ["name", "location", "property_token"]
        }
        if update_data:
            db.table("hotel_directory").update(update_data).eq("id", entry_id).execute()
        return {"status": "success", "id": entry_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def get_admin_hotels_logic(db: Client, limit: int = 100) -> List[Dict[str, Any]]:
    """List all registered properties with detailed user ownership info."""
    hotels = db.table("hotels").select("*").limit(limit).execute().data or []

    # Fetch all mappings to identify who owns what capacity
    mappings = (
        db.table("user_hotels").select("hotel_id, user_id, is_target").execute().data
        or []
    )

    # Fetch all profiles to show human-readable names/emails
    profiles = (
        db.table("user_profiles").select("user_id, email, display_name").execute().data
        or []
    )
    profile_map = {str(p["user_id"]): p for p in profiles}

    # Group mappings by hotel
    hotel_user_map = {}
    for m in mappings:
        hid = str(m["hotel_id"])
        if hid not in hotel_user_map:
            hotel_user_map[hid] = []

        prof = profile_map.get(str(m["user_id"]), {})
        hotel_user_map[hid].append(
            {
                "user_id": m["user_id"],
                "email": prof.get("email"),
                "display_name": prof.get("display_name"),
                "is_target": m.get("is_target", False),
                "role": "target" if m.get("is_target") else "competitor",
            }
        )

    results = []
    for h in hotels:
        hid = str(h["id"])
        user_list = hotel_user_map.get(hid, [])
        results.append(
            {
                "id": h["id"],
                "name": h["name"],
                "location": h["location"],
                "user_count": len(user_list),
                "users": user_list,
                "property_token": h.get("property_token"),
                "created_at": h["created_at"],
            }
        )
    return results


async def update_admin_hotel_logic(
    hotel_id: str, updates: dict, db: Client
) -> Dict[str, Any]:
    """Update hotel details via Admin API."""
    allowed = [
        "name",
        "location",
        "property_token",
        "is_target_hotel",
        "preferred_currency",
        "rating",
        "stars",
    ]
    update_data = {k: v for k, v in updates.items() if k in allowed}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        db.table("hotels").update(update_data).eq("id", hotel_id).execute()
    return {"status": "success", "hotel_id": hotel_id}


async def delete_admin_hotel_logic(hotel_id: str, db: Client) -> Dict[str, Any]:
    """Delete hotel but PRESERVE price_logs for historical data."""
    # SAFEGUARD: Price logs are NOT deleted.
    # Historical pricing data is valuable and should persist even if the hotel
    # is removed. If the hotel is re-added later, the data reconnects via hotel_id.
    db.table("alerts").delete().eq("hotel_id", hotel_id).execute()
    db.table("hotels").delete().eq("id", hotel_id).execute()
    return {"status": "success"}


async def get_admin_feed_logic(
    limit: int = 50, db: Client = None
) -> List[Dict[str, Any]]:
    """Get live agent feed logs."""
    try:
        logs_res = (
            db.table("query_logs")
            .select("id, hotel_name, action_type, status, created_at, price, currency")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return logs_res.data or []
    except Exception:
        return []


async def get_reports_logic(user_id: UUID, db: Client) -> JSONResponse:
    """Fetch data for reporting."""
    try:
        # 1. Fetch Scan Sessions (Traditional reports)
        sessions_res = (
            db.table("scan_sessions")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        sessions = [
            s for s in (sessions_res.data or []) if (s.get("hotels_count") or 0) > 0
        ]

        # 2. Fetch Agentic Briefings (Phase 4 saved reports)
        briefings_res = (
            db.table("reports")
            .select("id, title, report_type, created_at, created_by")
            .eq("report_type", "briefing")
            .or_(f"created_by.eq.{user_id},created_by.is.null")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        briefings = briefings_res.data or []

        summary = {
            "total_scans": len(sessions),
            "total_briefings": len(briefings),
            "system_health": "100%",
        }

        return JSONResponse(
            content=jsonable_encoder(
                {
                    "sessions": sessions,
                    "briefings": briefings,
                    "weekly_summary": summary,
                }
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def export_report_logic(user_id: UUID, format: str, db: Client) -> Any:
    """Export report data as CSV."""
    if format != "csv":
        return {"status": "error", "message": "Only CSV supported"}

    mapping = (
        db.table("user_hotels")
        .select("hotel_id, hotels(id, name)")
        .eq("user_id", str(user_id))
        .execute()
        .data
        or []
    )
    hotel_map = {}
    for m in mapping:
        h = m.get("hotels")
        if h:
            hotel_map[str(h["id"])] = h["name"]

    hotel_ids = list(hotel_map.keys())

    logs = (
        db.table("price_logs")
        .select("*")
        .in_("hotel_id", hotel_ids)
        .order("recorded_at", desc=True)
        .limit(1000)
        .execute()
        .data
        or []
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Hotel", "Price", "Currency"])
    for entry in logs:
        writer.writerow(
            [
                entry["recorded_at"],
                hotel_map.get(entry["hotel_id"], "Unknown"),
                entry["price"],
                entry.get("currency", "USD"),
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{user_id}.csv"},
    )


async def get_admin_scans_logic(db: Client, limit: int = 50) -> List[Dict[str, Any]]:
    """List recent scan sessions."""
    sessions = (
        db.table("scan_sessions")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    user_ids = list(set(s["user_id"] for s in sessions))
    profiles = (
        db.table("user_profiles")
        .select("user_id, display_name")
        .in_("user_id", user_ids)
        .execute()
    )
    users_map = {
        p["user_id"]: p.get("display_name", "Unknown") for p in (profiles.data or [])
    }

    results = []
    for s in sessions:
        results.append(
            {
                "id": s["id"],
                "user_id": s["user_id"],
                "user_name": users_map.get(s["user_id"], "Unknown"),
                "session_type": s["session_type"],
                "status": s["status"],
                "hotels_count": s["hotels_count"],
                "created_at": s["created_at"],
                "completed_at": s["completed_at"],
                "has_payload": s.get("raw_payload") is not None,
            }
        )
    return results


async def get_admin_scan_details_logic(scan_id: UUID, db: Client) -> Dict[str, Any]:
    """Fetch detailed logs and results for a specific scan."""
    try:
        session = (
            db.table("scan_sessions")
            .select("*")
            .eq("id", str(scan_id))
            .single()
            .execute()
            .data
        )
        if not session:
            raise HTTPException(404, "Scan session not found")

        logs = (
            db.table("query_logs")
            .select("*")
            .eq("session_id", str(scan_id))
            .execute()
            .data
            or []
        )

        return {"session": session, "logs": logs}
    except Exception as e:
        raise HTTPException(500, str(e))


async def get_admin_scan_export_logic(scan_id: UUID, db: Client) -> StreamingResponse:
    """
    KAIZEN: The Extraction Vault Export (Phase 1.2)
    Optimized for high-performance streaming and deep payload traversal.
    Specifically targets DataForSEO nested arrays and handles large datasets
    without causing OOM by yielding CSV chunks.
    """
    try:
        res = (
            db.table("scan_sessions")
            .select("raw_payload")
            .eq("id", str(scan_id))
            .single()
            .execute()
        )

        if not res.data or not res.data.get("raw_payload"):
            raise HTTPException(404, "No raw payload found in the extraction vault.")

        payload = res.data["raw_payload"]

        # EXPLANATION: Deep Payload Navigation
        # DataForSEO results are often nested in tasks[0].result[0].items.
        # We attempt to find this specific path first.
        target_items = None
        if isinstance(payload, dict):
            # Check for DataForSEO structure
            try:
                tasks = payload.get("tasks", [])
                if tasks and isinstance(tasks, list):
                    results = tasks[0].get("result", [])
                    if results and isinstance(results, list):
                        items = results[0].get("items", [])
                        if isinstance(items, list) and items:
                            target_items = items
            except (IndexError, KeyError, TypeError):
                pass
            
            # Fallback to search for any large list if DataForSEO path failed
            if not target_items:
                results_key = None
                for key, value in payload.items():
                    if isinstance(value, list) and (
                        not results_key or len(value) > len(payload[results_key])
                    ):
                        results_key = key
                if results_key:
                    target_items = payload[results_key]

        elif isinstance(payload, list):
            target_items = payload

        if not target_items:
            # If still nothing, just normalize the whole payload if it exists
            target_items = payload if payload else []

        # Normalize the JSON payload into a flat table
        # NOTE: We keep the dataframe in memory, but stream the serialization phase.
        try:
            df = pd.json_normalize(target_items)
        except Exception as e:
            print(f"Normalization failed: {e}")
            # Minimal fallback if normalization fails
            df = pd.DataFrame(target_items)

        if df.empty:
            raise HTTPException(400, "Extraction payload resulted in an empty dataset.")

        # EXPLANATION: True Chunked Streaming
        # We use a generator to yield CSV chunks. This prevents the server from
        # building a massive string/BytesIO object in memory for large exports.
        async def csv_generator():
            output = io.StringIO()
            # Write headers first
            df.head(0).to_csv(output, index=False)
            yield output.getvalue().encode("utf-8")
            output.truncate(0)
            output.seek(0)

            chunk_size = 500  # Process 500 rows at a time
            for i in range(0, len(df), chunk_size):
                chunk = df.iloc[i : i + chunk_size]
                chunk.to_csv(output, index=False, header=False)
                yield output.getvalue().encode("utf-8")
                output.truncate(0)
                output.seek(0)

        return StreamingResponse(
            csv_generator(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=scan_{scan_id}.csv",
                "X-Export-Rows": str(len(df)),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Extraction Export Error: {e}")
        traceback.print_exc()
        raise HTTPException(500, f"Export failed: {str(e)}")


async def get_admin_plans_logic(db: Client) -> List[Dict[str, Any]]:
    """List all available membership plans."""
    try:
        res = db.table("membership_plans").select("*").order("price_monthly").execute()
        return res.data or []
    except Exception:
        # Fallback to defaults if table doesn't exist yet
        return [
            {"id": "starter", "name": "Starter", "price_monthly": 49, "hotel_limit": 5},
            {"id": "pro", "name": "Pro", "price_monthly": 149, "hotel_limit": 25},
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price_monthly": 399,
                "hotel_limit": 999,
            },
        ]


async def create_admin_plan_logic(plan: PlanCreate, db: Client) -> Dict[str, Any]:
    """Create a new membership plan."""
    try:
        data = plan.model_dump()
        res = db.table("membership_plans").insert(data).execute()
        return res.data[0] if res.data else {"status": "success"}
    except Exception as e:
        raise HTTPException(500, str(e))


async def update_admin_plan_logic(
    id: UUID, plan: PlanUpdate, db: Client
) -> Dict[str, Any]:
    """Update an existing membership plan."""
    try:
        data = plan.model_dump(exclude_unset=True)
        res = db.table("membership_plans").update(data).eq("id", str(id)).execute()
        return res.data[0] if res.data else {"status": "success"}
    except Exception as e:
        raise HTTPException(500, str(e))


async def delete_admin_plan_logic(id: UUID, db: Client) -> Dict[str, Any]:
    """Delete a membership plan."""
    try:
        db.table("membership_plans").delete().eq("id", str(id)).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(500, str(e))


async def delete_plan_logic(db: Client, plan_id: UUID) -> bool:
    """Delete a plan."""
    try:
        db.table("membership_plans").delete().eq("id", str(plan_id)).execute()
        return True
    except Exception as e:
        print(f"Admin: Delete plan failure: {e}")
        return False


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
            except Exception:
                continue
        avg_latency = (sum(latencies) / len(latencies)) if latencies else 0.0

        # 5. Provider Health (from scan_batches)
        session_ids = [
            log["session_id"] for log in heartbeat_logs.data if log.get("session_id")
        ]
        provider_health = []
        serpapi_success_rate = 100.0

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
                serpapi_success_rate = (
                    (tot_success / tot_calls * 100) if tot_calls > 0 else 100.0
                )

                last_batch_time = None
                try:
                    last_batch_time = datetime.fromisoformat(
                        batches_res.data[0]["updated_at"].replace("Z", "+00:00")
                    )
                except Exception:
                    pass

                provider_health = [
                    ProviderHealth(
                        name="SerpApi",
                        status="online" if serpapi_success_rate > 80 else "degraded",
                        last_call=last_batch_time,
                        success_rate=round(serpapi_success_rate, 2),
                    )
                ]

        # 6. Scan Volume (Hourly bins)
        scan_volume_map = {}
        for log in heartbeat_logs.data:
            try:
                dt = datetime.fromisoformat(log["start_time"].replace("Z", "+00:00"))
                hour_key = dt.replace(minute=0, second=0, microsecond=0)
                scan_volume_map[hour_key] = scan_volume_map.get(hour_key, 0) + (
                    log.get("hotels_count") or 0
                )
            except Exception:
                continue

        scan_volume = [
            ScanVolume(timestamp=k, count=v)
            for k, v in sorted(scan_volume_map.items())
        ]

        # 7. Status Determination
        overall_status = "operational"
        if is_maintenance:
            overall_status = "maintenance"
        elif uptime_24h < 90 or serpapi_success_rate < 80:
            overall_status = "degraded"

        last_heartbeat_time = None
        try:
            last_heartbeat_time = datetime.fromisoformat(
                heartbeat_logs.data[0]["start_time"].replace("Z", "+00:00")
            )
        except Exception:
            pass

        # Active nodes: unique trigger sources in the last 4 hours
        four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=4)
        active_nodes_count = len(
            set(
                log.get("trigger_source")
                for log in heartbeat_logs.data
                if log.get("trigger_source")
                and datetime.fromisoformat(log["start_time"].replace("Z", "+00:00"))
                > four_hours_ago
            )
        )

        return HealthMetrics(
            overall_status=overall_status,
            uptime_24h=round(uptime_24h, 2),
            avg_latency=round(avg_latency, 2),
            active_nodes=max(1, active_nodes_count),
            last_heartbeat=last_heartbeat_time,
            provider_health=provider_health,
            scan_volume=scan_volume,
        )

    except Exception as e:
        print(f"Admin: Heartbeat logic failure: {e}")
        # Return a safe fallback instead of crashing
        return HealthMetrics(
            overall_status="degraded",
            uptime_24h=0.0,
            avg_latency=0.0,
            active_nodes=0,
            last_heartbeat=None,
            provider_health=[],
            scan_volume=[],
        )


async def get_admin_settings_logic(db: Client) -> AdminSettings:
    """Fetch global settings."""
    res = db.table("admin_settings").select("*").limit(1).execute()
    if res.data:
        return AdminSettings(**res.data[0])
    return AdminSettings(
        id=UUID("00000000-0000-0000-0000-000000000000"),
        maintenance_mode=False,
        signup_enabled=True,
        default_currency="USD",
        updated_at=datetime.now(timezone.utc),
    )


async def sync_hotel_directory_logic(db: Client) -> Dict[str, Any]:
    """
    Consolidated logic to sync active hotels into the global directory.
    Replaces fragmented backfill_*.py scripts.
    KAİZEN: Bi-directional Token Correction (Phase 1.1)
    """
    try:
        # 1. Fetch all hotels from active 'hotels' table
        hotels_res = db.table("hotels").select("*").execute()
        active_hotels = hotels_res.data or []

        synced_count = 0
        updated_count = 0
        token_backfills = 0

        for hotel in active_hotels:
            # 2. Check if already in directory (by SerpApi ID or exact name+location)
            serp_id = hotel.get("serp_api_id")
            hid = hotel["id"]

            existing = None
            if serp_id:
                existing_res = (
                    db.table("hotel_directory")
                    .select("*")
                    .eq("serp_api_id", serp_id)
                    .execute()
                )
                existing = existing_res.data[0] if existing_res.data else None

            if not existing:
                existing_res = (
                    db.table("hotel_directory")
                    .select("*")
                    .eq("name", hotel["name"])
                    .eq("location", hotel["location"])
                    .execute()
                )
                existing = existing_res.data[0] if existing_res.data else None

            dir_data = {
                "name": hotel["name"],
                "location": hotel["location"],
                "serp_api_id": serp_id,
                "rating": hotel.get("rating"),
                "stars": hotel.get("stars"),
                "image_url": hotel.get("image_url"),
                "latitude": hotel.get("latitude"),
                "longitude": hotel.get("longitude"),
            }

            if existing:
                # Update directory logic
                db.table("hotel_directory").update(dir_data).eq(
                    "id", existing["id"]
                ).execute()
                updated_count += 1

                # KAİZEN: Re-align hotel token if directory has a better one
                dir_serp_id = existing.get("serp_api_id")
                if dir_serp_id and dir_serp_id != serp_id:
                    db.table("hotels").update({"serp_api_id": dir_serp_id}).eq(
                        "id", hid
                    ).execute()
                    token_backfills += 1
            else:
                db.table("hotel_directory").insert(dir_data).execute()
                synced_count += 1

        return {
            "status": "success",
            "hotels_processed": len(active_hotels),
            "new_entries": synced_count,
            "updated_entries": updated_count,
            "token_corrections": token_backfills,
        }
    except Exception as e:
        print(f"Admin: Directory Sync Error: {e}")
        return {"status": "error", "message": str(e)}


async def cleanup_test_data_logic(db: Client) -> Dict[str, Any]:
    """
    Removes test records and artifacts from the system.
    """
    try:
        # Delete items with 'test' or 'dummy' in name (CAUTION: Admin only)
        # For safety, we only delete from hotels table specifically marked or known test hotels
        test_hotels = db.table("hotels").select("id").ilike("name", "%test%").execute()
        hotel_ids = [h["id"] for h in (test_hotels.data or [])]

        if hotel_ids:
            # SAFEGUARD: Price logs are NOT deleted — historical data is preserved.
            db.table("alerts").delete().in_("hotel_id", hotel_ids).execute()
            db.table("hotels").delete().in_("id", hotel_ids).execute()

        return {"status": "success", "deleted_count": len(hotel_ids)}
    except Exception as e:
        print(f"Admin: Cleanup Error: {e}")
        return {"status": "error", "message": str(e)}


async def get_admin_market_intelligence_logic(
    db: Client, city: Optional[str] = None
) -> Dict[str, Any]:
    """
    Aggregate market intelligence for admin panel Intelligence tab.

    EXPLANATION: Admin Market Intelligence
    Fetches hotels from the global directory (filtered by city), then looks up
    the latest price for each hotel from price_logs. Returns the { hotels, summary }
    shape expected by the AnalyticsPanel frontend component.
    This was previously (incorrectly) calling get_admin_stats_logic which returned
    AdminStats data, causing a 'Cannot read properties of undefined (reading slice)' crash.
    """
    try:
        # 1. Fetch hotels from directory, filtered by city if specified
        query = (
            db.table("hotel_directory")
            .select("*")
            .order("created_at", desc=True)
            .limit(200)
        )
        if city:
            query = query.ilike("location", f"%{city}%")
        dir_result = query.execute()
        directory_hotels = dir_result.data or []

        # 2. Fetch latest prices from tracked hotels in the same city
        #    We join via hotels table (which has serp_api_id) to price_logs
        hotels_query = db.table("hotels").select("id, name, location, serp_api_id")
        if city:
            hotels_query = hotels_query.ilike("location", f"%{city}%")
        tracked_result = hotels_query.limit(200).execute()
        tracked_hotels = tracked_result.data or []

        # Build map of latest prices and coordinates from tracked hotels
        # We pre-aggregate from tracked table to use as a primary fallback
        tracked_meta = {}  # hotel_id -> {price, lat, lng, serp_id, name}
        for h in tracked_hotels:
            hid = str(h["id"])
            tracked_meta[hid] = {
                "price": h.get("current_price", 0) or 0,
                "lat": h.get("latitude"),
                "lng": h.get("longitude"),
                "serp_id": h.get("serp_api_id"),
                "name": h.get("name", "").lower(),
            }

        # EXPLANATION: Deep Price Recovery
        # We try to get the ABSOLUTE latest price from logs, but if missing,
        # we trust the 'current_price' column in the hotels table (Phase 1).
        price_map = {hid: meta["price"] for hid, meta in tracked_meta.items()}

        if tracked_hotels:
            # Batch fetch latest price for all target hotels to reduce DB roundtrips
            recent_logs = (
                db.table("price_logs")
                .select("hotel_id, price")
                .in_("hotel_id", [str(h["id"]) for h in tracked_hotels])
                .order("recorded_at", desc=True)
                .limit(len(tracked_hotels) * 10)
                .execute()
            )

            for log in recent_logs.data or []:
                hid = str(log["hotel_id"])
                # Only update if we haven't found a 'more recent' one in this batch
                # (since they are ordered by date DESC)
                if hid not in price_map or price_map[hid] == 0:
                    price_map[hid] = log.get("price", 0)

        # 3. Build unified hotel list from directory entries
        #    If a directory hotel has a matching tracked hotel (by serp_api_id or name),
        #    attach the latest price
        hotels_out = []
        {h.get("serp_api_id"): h for h in tracked_hotels if h.get("serp_api_id")}
        {h["name"].lower(): h for h in tracked_hotels}

        for dh in directory_hotels:
            latest_price = 0
            matched_meta = None

            # Match Logic: SerpID First, then Exact Name, then Fuzzy Name
            serp_id = dh.get("serp_api_id")
            dh_name = dh.get("name", "").lower()

            # Find best match from tracked_meta
            for hid, m in tracked_meta.items():
                if serp_id and m["serp_id"] == serp_id:
                    matched_meta = m
                    latest_price = price_map.get(hid, 0)
                    break
                if dh_name == m["name"]:
                    matched_meta = m
                    latest_price = price_map.get(hid, 0)
                    break
                # KAİZEN: Cross-Reference Partial Match
                # Handles "Hotel X" vs "Hotel X Balikesir"
                if dh_name in m["name"] or m["name"] in dh_name:
                    matched_meta = m
                    latest_price = price_map.get(hid, 0)
                    break

            # Fallback Logic:
            # 1. Directory Coords
            # 2. Tracked Coords (if matched)
            # 3. City Center Fallback (with small random jitter for visual distribution)
            import random

            lat = dh.get("latitude")
            lng = dh.get("longitude")

            if (lat is None or lng is None) and matched_meta:
                lat = matched_meta.get("lat") if lat is None else lat
                lng = matched_meta.get("lng") if lng is None else lng

            # Final Fallback to District Center if still None (District-Aware Kaizen)
            if (lat is None or lng is None) and city and city.lower() == "balikesir":
                loc_str = (dh.get("location") or "").lower()
                dh["name"].lower()

                # Ayvalik / Cunda (West Coast)
                if "ayvalik" in loc_str or "cunda" in loc_str or "küçükköy" in loc_str:
                    lat_base, lng_base = 39.3197, 26.6908
                # Edremit / Akcay / Altinoluk (North Coast)
                elif (
                    "edremit" in loc_str
                    or "akcay" in loc_str
                    or "altinoluk" in loc_str
                    or "akçay" in loc_str
                ):
                    lat_base, lng_base = 39.5852, 26.9248
                # Default Balikesir Center (Inland)
                else:
                    lat_base, lng_base = 39.6482, 27.8826

                # Add small jitter for visual distribution (0.03 ~ 3.3km)
                lat = lat_base + (random.random() - 0.5) * 0.03
                lng = lng_base + (random.random() - 0.5) * 0.03

            hotels_out.append(
                {
                    "id": str(dh["id"]),
                    "name": dh["name"],
                    "location": dh.get("location", "Unknown"),
                    "latest_price": float(latest_price),
                    "latitude": lat,
                    "longitude": lng,
                    "rating": dh.get("rating"),
                    "serp_api_id": dh.get("serp_api_id"),
                }
            )

        # EXPLANATION: Master Summary Statistics
        # Requirement: Populate the top 4 stat cards in AnalyticsPanel.
        prices = [
            h["latest_price"]
            for h in hotels_out
            if h["latest_price"] and h["latest_price"] > 0
        ]
        avg_price = round(sum(prices) / len(prices), 2) if prices else 0
        price_range = [min(prices), max(prices)] if prices else [0, 0]
        with_price_count = len(prices)
        total_count = len(hotels_out)
        scan_coverage = (
            round((with_price_count / total_count) * 100, 1) if total_count > 0 else 0
        )

        # EXPLANATION: Historical Visibility Data Aggregation (Last 30 days)
        # Requirement: "Regional Visibility" chart needs actual data vs "No Data".
        # We aggregate 1-based ranks from SerpApi results stored in price_logs.
        visibility_data = []
        try:
            # Fix: Ensure hotel_ids is derived from local tracked_hotels scope
            hotel_ids_for_vis = [str(h["id"]) for h in tracked_hotels]

            if hotel_ids_for_vis:
                thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()

                # KAİZEN: Use batch query to avoid N+1 lookups for city-wide visibility
                vis_query = (
                    db.table("price_logs")
                    .select("recorded_at, search_rank, price")
                    .in_("hotel_id", hotel_ids_for_vis)
                    .gte("recorded_at", thirty_days_ago)
                    .order("recorded_at", desc=False)
                    .execute()
                )

                raw_vis = vis_query.data or []

                # Group by date to get daily average rank for the selected region
                daily_aggregates = {}

                # KAİZEN: Synthetic Rank Fallback
                # If search_rank is missing in the database, we calculate a proximity rank based on price
                # (Lower price = better rank/visibility in default marketplace searches)
                has_any_rank = any(e.get("search_rank") is not None for e in raw_vis)

                if not has_any_rank and raw_vis:
                    # Sort daily batches by price to assign synthetic ranks
                    by_date = {}
                    for e in raw_vis:
                        d = e["recorded_at"].split("T")[0]
                        if d not in by_date:
                            by_date[d] = []
                        by_date[d].append(e)

                    for d, entries in by_date.items():
                        # Sort by price ascending (cheapest = rank 1)
                        sorted_entries = sorted(
                            entries, key=lambda x: x.get("price", 999999)
                        )
                        for i, e in enumerate(sorted_entries):
                            e["search_rank"] = i + 1  # Assign rank 1, 2, 3...

                for entry in raw_vis:
                    # KAİZEN: Explicit None check for search_rank
                    val_rank = entry.get("search_rank")
                    if val_rank is None or not entry.get("recorded_at"):
                        continue

                    # Normalize date to YYYY-MM-DD for Recharts binding
                    dt_str = entry["recorded_at"].split("T")[0]
                    if dt_str not in daily_aggregates:
                        daily_aggregates[dt_str] = {
                            "sum_rank": 0.0,
                            "count": 0,
                            "sum_price": 0.0,
                        }

                    daily_aggregates[dt_str]["sum_rank"] += float(val_rank)
                    daily_aggregates[dt_str]["sum_price"] += entry.get("price", 0)
                    daily_aggregates[dt_str]["count"] += 1

                for date_key in sorted(daily_aggregates.keys()):
                    agg = daily_aggregates[date_key]
                    visibility_data.append(
                        {
                            "date": date_key,
                            "rank": round(agg["sum_rank"] / agg["count"], 1),
                            "price": round(agg["sum_price"] / agg["count"], 2),
                        }
                    )
        except Exception as e:
            print(f"Visibility Aggregation Error: {e}")

        # KAİZEN: Dynamic Currency Detection
        # Instead of hardcoding '$', we detect the currency used in the most recent scans.
        detected_currency = "TRY"
        try:
            hotel_ids_for_curr = [str(h["id"]) for h in tracked_hotels]
            if hotel_ids_for_curr:
                curr_res = (
                    db.table("price_logs")
                    .select("currency")
                    .in_("hotel_id", hotel_ids_for_curr)
                    .not_.is_("currency", "null")
                    .limit(1)
                    .execute()
                )
                if curr_res.data:
                    detected_currency = curr_res.data[0].get("currency", "TRY")
        except Exception:
            pass

        # EXPLANATION: Competitive Network Generation
        # Requirement: "Competitive Clusters" section expects nodes/links.
        # Logic: We take top 15 hotels by price and link each to its two closest price neighbors.
        priced_subset = sorted(
            [h for h in hotels_out if h["latest_price"] > 0],
            key=lambda x: x["latest_price"],
            reverse=True,
        )[:15]
        nodes = []
        links = []

        # EXPLANATION: YOU Node Identification
        # To populate the center of the CompsetGraph, we need a 'target' type.
        # We look for a hotel that matches this user's primary track or the first in set.
        target_id = None
        for h in tracked_hotels:
            if h.get("is_target_hotel"):
                target_id = str(h["id"])
                break

        has_target = False
        for h in priced_subset:
            hid = str(h["id"])
            is_main = (hid == target_id) or (not target_id and not has_target)
            if is_main:
                has_target = True

            nodes.append(
                {
                    "id": hid,
                    "label": h["name"],
                    "value": float(h["latest_price"]),
                    "type": "target" if is_main else "competitor",
                }
            )

        # Build links between adjacent priced hotels
        for i in range(len(priced_subset)):
            if i + 1 < len(priced_subset):
                links.append(
                    {
                        "source": priced_subset[i]["id"],
                        "target": priced_subset[i + 1]["id"],
                        "label": "Price Rival",
                    }
                )
            if i + 2 < len(priced_subset):
                links.append(
                    {
                        "source": priced_subset[i]["id"],
                        "target": priced_subset[i + 2]["id"],
                        "label": "Market Tier",
                    }
                )

        # EXPLANATION: Latest Agentic Briefing
        # Fetches the absolute latest system-wide briefing for immediate display in the dashboard.
        latest_briefing = None
        try:
            lb_res = (
                db.table("reports")
                .select("report_data, created_at")
                .eq("report_type", "briefing")
                .is_("created_by", "null")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if lb_res.data:
                latest_briefing = lb_res.data[0]
        except Exception as lb_e:
            print(f"Failed to fetch latest briefing: {lb_e}")

        return {
            "hotels": hotels_out,
            "visibility": visibility_data,
            "network": {"nodes": nodes, "links": links},
            "latest_briefing": latest_briefing,
            "summary": {
                "hotel_count": total_count,
                "avg_price": avg_price,
                "price_range": price_range,
                "scan_coverage_pct": scan_coverage,
                "currency": detected_currency,
                "currency_symbol": "₺" if detected_currency == "TRY" else "$",
            },
        }
    except Exception as e:
        print(f"Admin Market Intelligence Error: {e}")
        traceback.print_exc()
        # Return safe empty structure instead of crashing
        return {
            "hotels": [],
            "summary": {
                "hotel_count": 0,
                "avg_price": 0,
                "price_range": [0, 0],
                "scan_coverage_pct": 0,
            },
        }


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
    except Exception as e:
        print(f"Admin Scheduler Queue Error: {e}")
        return []


async def update_admin_settings_logic(
    updates: AdminSettingsUpdate, db: Client
) -> AdminSettings:
    """Update global settings."""
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
    except Exception as e:
        print(f"Trigger All Overdue Error: {e}")
        return {"error": str(e)}


async def cleanup_empty_scans_logic(db: Client) -> Dict[str, Any]:
    """
    Identifies and removes scan sessions that have no results.
    Criteria:
    - raw_payload is NULL
    """
    try:
        # KAIZEN: Simplified to a single-line batch deletion per exact requirement.
        # This removes all sessions where no DataForSEO payload was ever saved.
        response = db.table("scan_sessions").delete().is_("raw_payload", "null").execute()
        
        # In PostgREST, delete returns the deleted rows if 'return=representation' is handled by the client.
        # If not, data might be empty. We check if response.data is available.
        deleted_count = len(response.data) if hasattr(response, 'data') and response.data else 0
        
        return {
            "status": "success",
            "count": deleted_count,
            "message": f"Successfully removed {deleted_count} empty scan sessions."
        }
    except Exception as e:
        print(f"Admin: Cleanup failed: {e}")
        return {"status": "error", "error": str(e)}


async def get_admin_batches_logic(db: Client, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch live extraction batches for monitoring.
    Includes success/failure counts and progress percentage.
    """
    try:
        # EXPLANATION: Batch Monitoring
        # Providing visibility into individual 'Live Extraction' clusters.
        # This helps admins track the throughput of their scraper nodes.
        res = (
            db.table("scan_batches")
            .select("*, hotels(name)")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        batches = res.data or []
        for b in batches:
            total = b.get("total_tasks") or 0
            success = b.get("success_count") or 0
            failed = b.get("failure_count") or 0

            if total > 0:
                b["progress"] = round(((success + failed) / total) * 100, 1)
            else:
                b["progress"] = 0

        return batches
    except Exception as e:
        print(f"Admin Batches Logic Error: {e}")
        return []


async def get_admin_batch_details_logic(db: Client, batch_id: str) -> Dict[str, Any]:
    """
    Fetch all tasks associated with a specific batch.
    Includes deep details for diagnostics.
    """
    try:
        # 1. Get batch metadata
        batch_res = (
            db.table("scan_batches")
            .select("*, hotels(name)")
            .eq("id", batch_id)
            .single()
            .execute()
        )
        batch = batch_res.data

        # 2. Get tasks
        tasks_res = (
            db.table("scan_tasks")
            .select("*, hotels(name)")
            .eq("batch_id", batch_id)
            .order("created_at", desc=False)
            .execute()
        )

        return {"batch": batch, "tasks": tasks_res.data or []}
    except Exception as e:
        print(f"Admin Batch Details Logic Error: {e}")
        return {"error": str(e)}


async def rescan_batch_task_logic(db: Client, task_id: str) -> Dict[str, Any]:
    """
    Resets a failed task to 'pending' to trigger a retry.
    Useful for manual recovery of failed individual extraction tasks.
    """
    try:
        # EXPLANATION: Granular Task Recovery
        # Resets individual task states to allow the monitor service
        # to pick them up again in the next extraction cycle.
        db.table("scan_tasks").update(
            {
                "status": "pending",
                "error_message": None,
                "started_at": None,
                "completed_at": None,
            }
        ).eq("id", task_id).execute()

        return {"status": "success", "message": "Task reset to pending for retry."}
    except Exception as e:
        print(f"Rescan Task Logic Error: {e}")
        return {"error": str(e)}
