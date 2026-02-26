"""
Admin Service.
Handles system-wide operations, manual directory syncs, user administration,
and system-level reporting.
"""

import os
import traceback
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import HTTPException
from supabase import create_client, Client

from backend.models.schemas import (
    AdminStats, AdminUser, AdminUserCreate, AdminUserUpdate, AdminDirectoryEntry, 
    AdminLog, AdminSettings, AdminSettingsUpdate, PlanCreate, PlanUpdate
)
from backend.services.serpapi_client import serpapi_client
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
import csv
import io

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
        users_count = db.table("settings").select("user_id", count="exact").execute().count or 0
        
        # Count Hotels
        hotels_count = db.table("hotels").select("id", count="exact").execute().count or 0
        
        # Count Scans
        scans_count = db.table("scan_sessions").select("id", count="exact").execute().count or 0
        
        # Count Directory
        directory_count = db.table("hotel_directory").select("id", count="exact").execute().count or 0
        
        # API Calls (Today)
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        api_calls = 0
        recent_scans = db.table("scan_sessions").select("hotels_count").gte("created_at", today_start.isoformat()).execute()
        if recent_scans.data:
            api_calls = sum(s.get("hotels_count", 0) for s in recent_scans.data)
            
        # 5. Scraper Health (Last 24h)
        # EXPLANATION: Operational Health Index
        # We calculate health as the percentage of successful or partially successful
        # scans over the last 24 hours. This allows administrators to quickly 
        # identify if an external provider (like SerpApi) is experiencing global issues.
        last_24h = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent_sessions_health = db.table("scan_sessions") \
            .select("status, created_at, completed_at") \
            .gte("created_at", last_24h) \
            .order("created_at", desc=True) \
            .limit(100) \
            .execute()
        health = 100.0
        avg_latency = 0.0
        error_rate = 0.0
        
        if recent_sessions_health.data:
            total_recent = len(recent_sessions_health.data)
            successes = sum(1 for s in recent_sessions_health.data if s["status"] in ["completed", "partial"])
            health = (successes / total_recent) * 100
            error_rate = ((total_recent - successes) / total_recent) * 100
            
            # Calculate Latency for successful scans
            durations = []
            for s in recent_sessions_health.data:
                if s["status"] in ["completed", "partial"] and s.get("created_at") and s.get("completed_at"):
                    try:
                        start = datetime.fromisoformat(s["created_at"].replace('Z', '+00:00'))
                        end = datetime.fromisoformat(s["completed_at"].replace('Z', '+00:00'))
                        durations.append((end - start).total_seconds() * 1000)
                    except Exception: pass
            
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
            service_role_active="SUPABASE_SERVICE_ROLE_KEY" in os.environ
        )
    except Exception as e:
        print(f"Admin Stats Error: {e}")
        raise HTTPException(status_code=500, detail=f"Admin Data Error: {str(e)}")

async def get_api_key_status_logic(db: Client) -> Dict[str, Any]:
    """Get status of SerpApi keys for monitoring quota usage."""
    try:
        status = await serpapi_client.get_key_status()
        
        # Calculate monthly usage from scan_sessions
        now = datetime.now()
        first_of_month = datetime(now.year, now.month, 1).isoformat()
        
        usage_res = db.table("scan_sessions") \
            .select("id", count="exact") \
            .gte("created_at", first_of_month) \
            .in_("status", ["completed", "partial"]) \
            .execute()
        monthly_usage = usage_res.count if usage_res.count is not None else 0
        
        status["quota_per_key"] = 250
        status["quota_period"] = "monthly"
        status["monthly_usage"] = monthly_usage
        
        detailed = await serpapi_client.get_detailed_status()
        keys_list = detailed.get("keys_status", [])
        
        # EXPLANATION: Metadata Injection (Kaizen 2026)
        # We merge hardcoded metadata (renewal dates, limits) from ProviderFactory 
        # into the dynamic usage data from serpapi_client.
        from backend.services.provider_factory import ProviderFactory
        factory_report = ProviderFactory.get_status_report()
        
        for i, key_entry in enumerate(keys_list):
            match_name = f"SerpApi Key {i+1}"
            meta = next((r for r in factory_report if match_name in r["name"]), None)
            
            # Use real data from serpapi_client if available, fallback to mock
            key_entry["refresh_date"] = key_entry.get("renewal_date") or (meta.get("refresh") if meta else "Unknown")
            key_entry["limit"] = meta.get("limit") if meta else "250/mo"
        
        status["keys_status"] = keys_list
        status["env_debug"] = {
            "SERPAPI_API_KEY": "Set" if os.getenv("SERPAPI_API_KEY") else "Missing",
            "SERPAPI_KEY": "Set" if os.getenv("SERPAPI_KEY") else "Missing",
            "NEXT_PUBLIC_SERPAPI_API_KEY": "Set" if os.getenv("NEXT_PUBLIC_SERPAPI_API_KEY") else "Missing",
            "SERPAPI_API_KEY_2": "Set" if os.getenv("SERPAPI_API_KEY_2") else "Missing",
            "SERPAPI_API_KEY_3": "Set" if os.getenv("SERPAPI_API_KEY_3") else "Missing",
            "SERPAPI_API_KEY_4": "Set" if os.getenv("SERPAPI_API_KEY_4") else "Missing"
        }
        return status
    except Exception as e:
        print(f"API Key Status Error: {e}")
        return {"error": str(e), "total_keys": 0, "active_keys": 0}


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
        return {"error": str(e), "total_keys": 0, "active_keys": 0}

async def force_rotate_api_key_logic() -> Dict[str, Any]:
    """Force rotate to next API key."""
    try:
        success = serpapi_client._key_manager.rotate_key("manual_rotation")
        return {
            "status": "success" if success else "failed",
            "message": "Rotated to next key" if success else "No available keys",
            "current_status": await serpapi_client.get_key_status()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def reset_api_keys_logic() -> Dict[str, Any]:
    """Reset all API keys."""
    try:
        serpapi_client._key_manager.reset_all()
        return {"status": "success", "message": "All keys reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def reload_api_keys_logic() -> Dict[str, Any]:
    """Reload API keys from env."""
    try:
        reload_result = serpapi_client.reload()
        return {
            "message": f"Reloaded keys. Found {reload_result.get('total_keys', 0)}.",
            "total_keys": reload_result.get('total_keys', 0),
            "current_status": serpapi_client.get_key_status()
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

async def admin_update_user_logic(user_id: UUID, updates: AdminUserUpdate, db: Client) -> Dict[str, Any]:
    """Admin: Update user details including schedule and settings."""
    try:
        user_id_str = str(user_id)
        # 1. Update Profile Fields
        profile_fields = {}
        if updates.display_name is not None: profile_fields["display_name"] = updates.display_name
        if updates.company_name is not None: profile_fields["company_name"] = updates.company_name
        if updates.job_title is not None: profile_fields["job_title"] = updates.job_title
        if updates.phone is not None: profile_fields["phone"] = updates.phone
        if updates.timezone is not None: profile_fields["timezone"] = updates.timezone
        if updates.plan_type is not None: profile_fields["plan_type"] = updates.plan_type
        if updates.subscription_status is not None: profile_fields["subscription_status"] = updates.subscription_status
        
        if profile_fields:
            db.table("user_profiles").update(profile_fields).eq("user_id", user_id_str).execute()
            if "plan_type" in profile_fields or "subscription_status" in profile_fields:
                sub_update = {k: v for k, v in profile_fields.items() if k in ["plan_type", "subscription_status"]}
                db.table("profiles").update(sub_update).eq("id", user_id_str).execute()

        # 2. Update Settings Fields
        if updates.check_frequency_minutes is not None:
             db.table("settings").update({"check_frequency_minutes": updates.check_frequency_minutes}).eq("user_id", user_id_str).execute()

        # 3. Update Auth Fields (Requires Admin Bypass)
        admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        if admin_key and url:
            admin_db = create_client(url, admin_key)
            auth_updates = {}
            if updates.email: auth_updates["email"] = updates.email
            if updates.password: auth_updates["password"] = updates.password
            if auth_updates:
                admin_db.auth.admin.update_user_by_id(user_id_str, auth_updates)

        return {"status": "success", "message": "User updated successfully"}
    except Exception as e:
        print(f"Admin Update User Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_admin_users_logic(db: Client) -> List[AdminUser]:
    """
    Fetch all users with enriched metadata (hotel/scan counts, plans).
    
    Reminder Note: This operation bypasses normal RLS to provide an 
    aggregated system-wide view.
    """
    # EXPLANATION: Admin User Management
    # Aggregates data from Auth, Profiles, and Settings to create a comprehensive
    # user view for the Admin Dashboard. This manual join is necessary because
    # user data is split across multiple tables (Supabase Auth vs Public Profiles).
    try:
        # Fetch profiles, settings, and subscription info
        profiles_res = db.table("user_profiles").select("*").execute()
        profiles_data = profiles_res.data or []
        
        settings_res = db.table("settings").select("user_id, check_frequency_minutes").execute()
        settings_data = settings_res.data or []
        
        sub_res = db.table("profiles").select("id, plan_type, subscription_status").execute()
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
                    "created_at": p.get("created_at") or datetime.now().isoformat()
                }
            
            sub_data = sub_map.get(uid, {})
            users_map[uid]["plan_type"] = sub_data.get("plan_type") or p.get("plan_type") or "trial"
            users_map[uid]["subscription_status"] = sub_data.get("subscription_status") or p.get("subscription_status") or "trial"

        final_users = []
        for uid, udata in users_map.items():
            try:
                # Optimized count fetch (In production use a view/RPC)
                h_count = db.table("hotels").select("id", count="exact").eq("user_id", uid).execute().count or 0
                s_count = db.table("scan_sessions").select("id", count="exact").eq("user_id", uid).execute().count or 0
                udata["hotel_count"] = h_count
                udata["scan_count"] = s_count
                
                # EXPLANATION: Plan-Based Quota Logic
                # Map plan types to their dynamic hotel limits to ensure Admin Panel 
                # Gauges reflect reality.
                from backend.services.subscription import SubscriptionService
                access = await SubscriptionService.get_user_limits(db, udata)
                udata["max_hotels"] = access.get("limits", {}).get("hotel_limit", 5)
                
                final_users.append(AdminUser(**udata))
            except Exception:
                udata["max_hotels"] = 5 # Absolute fallback
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
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not admin_key or not url:
        raise HTTPException(status_code=500, detail="Admin credentials missing")
    
    admin_db = create_client(url, admin_key)
    try:
        res = admin_db.auth.admin.create_user({
            "email": user.email,
            "password": user.password,
            "email_confirm": True
        })
        new_user = res.user
        if not new_user:
            raise HTTPException(status_code=400, detail="Supabase Auth rejected creation")
            
        admin_db.table("user_profiles").insert({
            "user_id": str(new_user.id),
            "display_name": user.display_name or user.email.split("@")[0],
            "email": user.email
        }).execute()
        
        return {"status": "success", "user_id": str(new_user.id)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def delete_admin_user_logic(user_id: str, db: Client) -> Dict[str, Any]:
    """
    Delete a user and cascade delete their data.
    """
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not admin_key or not url:
        raise HTTPException(status_code=500, detail="Admin credentials missing")
    
    admin_db = create_client(url, admin_key)
    tables = ["hotels", "scan_sessions", "user_profiles", "settings", "notifications", "reports"]
    for table in tables:
        try: admin_db.table(table).delete().eq("user_id", str(user_id)).execute()
        except: pass
    
    try: admin_db.auth.admin.delete_user(str(user_id))
    except: pass
        
    return {"status": "success"}

async def get_admin_logs_logic(db: Client, limit: int = 50) -> List[AdminLog]:
    """
    Fetch recent system activity logs.
    """
    try:
        result = db.table("scan_sessions").select("*").order("created_at", desc=True).limit(limit).execute()
        logs = []
        for session in (result.data or []):
            level = "INFO"
            if session["status"] == "failed": level = "ERROR"
            elif session["status"] == "completed": level = "SUCCESS"
                
            logs.append(AdminLog(
                id=session["id"],
                timestamp=session["created_at"],
                level=level,
                action=f"Scan Session ({session['session_type']})",
                details=f"Checked {session.get('hotels_count', 0)} hotels",
                user_id=session["user_id"]
            ))
        return logs
    except Exception:
        return []

async def get_admin_directory_logic(db: Client, limit: int = 100, city: Optional[str] = None) -> List[AdminDirectoryEntry]:
    """List directory entries."""
    query = db.table("hotel_directory").select("*").order("created_at", desc=True).limit(limit)
    if city:
        query = query.ilike("location", f"%{city}%")
    result = query.execute()
    entries = []
    for item in (result.data or []):
        entries.append(AdminDirectoryEntry(
            id=item["id"],
            name=item["name"],
            location=item["location"] or "Unknown",
            serp_api_id=item.get("serp_api_id"),
            created_at=item["created_at"]
        ))
    return entries

async def add_admin_directory_entry_logic(entry: dict, db: Client) -> Dict[str, Any]:
    """Add a directory entry manually."""
    try:
        db.table("hotel_directory").insert({
            "name": entry["name"],
            "location": entry["location"],
            "serp_api_id": entry.get("serp_api_id")
        }).execute()
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

async def update_admin_directory_logic(entry_id: str, updates: dict, db: Client) -> Dict[str, Any]:
    """Update a directory entry."""
    try:
        update_data = {k: v for k, v in updates.items() if k in ["name", "location", "serp_api_id"]}
        if update_data:
            db.table("hotel_directory").update(update_data).eq("id", entry_id).execute()
        return {"status": "success", "id": entry_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def get_admin_hotels_logic(db: Client, limit: int = 100) -> List[Dict[str, Any]]:
    """List all hotels with user info."""
    hotels = db.table("hotels").select("*").limit(limit).execute().data or []
    users = db.table("user_profiles").select("user_id, display_name, email").execute().data or []
    user_map = {u["user_id"]: u for u in users}
    
    results = []
    for h in hotels:
        user = user_map.get(h["user_id"], {})
        results.append({
            "id": h["id"],
            "name": h["name"],
            "location": h["location"],
            "user_id": h["user_id"],
            "user_display": user.get("display_name") or user.get("email"),
            "serp_api_id": h.get("serp_api_id"),
            "is_target_hotel": h["is_target_hotel"],
            "preferred_currency": h.get("preferred_currency"),
            "created_at": h["created_at"]
        })
    return results

async def update_admin_hotel_logic(hotel_id: str, updates: dict, db: Client) -> Dict[str, Any]:
    """Update hotel details via Admin API."""
    allowed = ["name", "location", "serp_api_id", "is_target_hotel", "preferred_currency", "rating", "stars"]
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

async def get_admin_feed_logic(limit: int = 50, db: Client = None) -> List[Dict[str, Any]]:
    """Get live agent feed logs."""
    try:
        logs_res = db.table("query_logs") \
            .select("id, hotel_name, action_type, status, created_at, price, currency") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        return logs_res.data or []
    except Exception:
        return []

async def get_reports_logic(user_id: UUID, db: Client) -> JSONResponse:
    """Fetch data for reporting."""
    try:
        # 1. Fetch Scan Sessions (Traditional reports)
        sessions_res = db.table("scan_sessions") \
            .select("*") \
            .eq("user_id", str(user_id)) \
            .order("created_at", desc=True) \
            .limit(50) \
            .execute()
        
        sessions = [s for s in (sessions_res.data or []) if (s.get("hotels_count") or 0) > 0]
        
        # 2. Fetch Agentic Briefings (Phase 4 saved reports)
        briefings_res = db.table("reports") \
            .select("id, title, report_type, created_at") \
            .eq("report_type", "briefing") \
            .eq("created_by", str(user_id)) \
            .order("created_at", desc=True) \
            .limit(50) \
            .execute()
        
        briefings = briefings_res.data or []
        
        summary = {
            "total_scans": len(sessions),
            "total_briefings": len(briefings),
            "system_health": "100%"
        }
        
        return JSONResponse(content=jsonable_encoder({
            "sessions": sessions,
            "briefings": briefings,
            "weekly_summary": summary
        }))
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

async def export_report_logic(user_id: UUID, format: str, db: Client) -> Any:
    """Export report data as CSV."""
    if format != "csv":
        return {"status": "error", "message": "Only CSV supported"}
        
    hotels = db.table("hotels").select("id, name").eq("user_id", str(user_id)).execute().data or []
    hotel_map = {h["id"]: h["name"] for h in hotels}
    hotel_ids = list(hotel_map.keys())
    
    logs = db.table("price_logs") \
        .select("*") \
        .in_("hotel_id", hotel_ids) \
        .order("recorded_at", desc=True) \
        .limit(1000) \
        .execute().data or []
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Hotel", "Price", "Currency"])
    for l in logs:
        writer.writerow([l["recorded_at"], hotel_map.get(l["hotel_id"], "Unknown"), l["price"], l.get("currency", "USD")])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{user_id}.csv"}
    )

async def get_admin_scans_logic(db: Client, limit: int = 50) -> List[Dict[str, Any]]:
    """List recent scan sessions."""
    sessions = db.table("scan_sessions").select("*").order("created_at", desc=True).limit(limit).execute().data or []
    user_ids = list(set(s["user_id"] for s in sessions))
    profiles = db.table("user_profiles").select("user_id, display_name").in_("user_id", user_ids).execute()
    users_map = {p["user_id"]: p.get("display_name", "Unknown") for p in (profiles.data or [])}
    
    results = []
    for s in sessions:
        results.append({
            "id": s["id"],
            "user_id": s["user_id"],
            "user_name": users_map.get(s["user_id"], "Unknown"),
            "session_type": s["session_type"],
            "status": s["status"],
            "hotels_count": s["hotels_count"],
            "created_at": s["created_at"],
            "completed_at": s["completed_at"]
        })
    return results

async def get_admin_scan_details_logic(scan_id: UUID, db: Client) -> Dict[str, Any]:
    """Fetch detailed logs and results for a specific scan."""
    try:
        session = db.table("scan_sessions").select("*").eq("id", str(scan_id)).single().execute().data
        if not session:
            raise HTTPException(404, "Scan session not found")
            
        logs = db.table("query_logs").select("*").eq("session_id", str(scan_id)).execute().data or []
        
        return {
            "session": session,
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(500, str(e))

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
            {"id": "enterprise", "name": "Enterprise", "price_monthly": 399, "hotel_limit": 999}
        ]

async def create_admin_plan_logic(plan: PlanCreate, db: Client) -> Dict[str, Any]:
    """Create a new membership plan."""
    try:
        data = plan.model_dump()
        res = db.table("membership_plans").insert(data).execute()
        return res.data[0] if res.data else {"status": "success"}
    except Exception as e:
        raise HTTPException(500, str(e))

async def update_admin_plan_logic(id: UUID, plan: PlanUpdate, db: Client) -> Dict[str, Any]:
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
        updated_at=datetime.now(timezone.utc)
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
                existing_res = db.table("hotel_directory").select("*").eq("serp_api_id", serp_id).execute()
                existing = existing_res.data[0] if existing_res.data else None
            
            if not existing:
                existing_res = db.table("hotel_directory").select("*").eq("name", hotel["name"]).eq("location", hotel["location"]).execute()
                existing = existing_res.data[0] if existing_res.data else None
            
            dir_data = {
                "name": hotel["name"],
                "location": hotel["location"],
                "serp_api_id": serp_id,
                "rating": hotel.get("rating"),
                "stars": hotel.get("stars"),
                "image_url": hotel.get("image_url"),
                "latitude": hotel.get("latitude"),
                "longitude": hotel.get("longitude")
            }
            
            if existing:
                # Update directory logic
                db.table("hotel_directory").update(dir_data).eq("id", existing["id"]).execute()
                updated_count += 1
                
                # KAİZEN: Re-align hotel token if directory has a better one
                dir_serp_id = existing.get("serp_api_id")
                if dir_serp_id and dir_serp_id != serp_id:
                     db.table("hotels").update({"serp_api_id": dir_serp_id}).eq("id", hid).execute()
                     token_backfills += 1
            else:
                db.table("hotel_directory").insert(dir_data).execute()
                synced_count += 1
                
        return {
            "status": "success",
            "hotels_processed": len(active_hotels),
            "new_entries": synced_count,
            "updated_entries": updated_count,
            "token_corrections": token_backfills
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

async def get_admin_market_intelligence_logic(db: Client, city: Optional[str] = None) -> Dict[str, Any]:
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
        query = db.table("hotel_directory").select("*").order("created_at", desc=True).limit(200)
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
        tracked_meta = {} # hotel_id -> {price, lat, lng, serp_id, name}
        for h in tracked_hotels:
            hid = str(h["id"])
            tracked_meta[hid] = {
                "price": h.get("current_price", 0) or 0,
                "lat": h.get("latitude"),
                "lng": h.get("longitude"),
                "serp_id": h.get("serp_api_id"),
                "name": h.get("name", "").lower()
            }

        # EXPLANATION: Deep Price Recovery
        # We try to get the ABSOLUTE latest price from logs, but if missing,
        # we trust the 'current_price' column in the hotels table (Phase 1).
        price_map = {hid: meta["price"] for hid, meta in tracked_meta.items()}
        
        if tracked_hotels:
            # Batch fetch latest price for all target hotels to reduce DB roundtrips
            recent_logs = db.table("price_logs") \
                .select("hotel_id, price") \
                .in_("hotel_id", [str(h["id"]) for h in tracked_hotels]) \
                .order("recorded_at", desc=True) \
                .limit(len(tracked_hotels) * 10) \
                .execute()
            
            for log in (recent_logs.data or []):
                hid = str(log["hotel_id"])
                # Only update if we haven't found a 'more recent' one in this batch
                # (since they are ordered by date DESC)
                if hid not in price_map or price_map[hid] == 0:
                    price_map[hid] = log.get("price", 0)

        # 3. Build unified hotel list from directory entries
        #    If a directory hotel has a matching tracked hotel (by serp_api_id or name),
        #    attach the latest price
        hotels_out = []
        tracked_by_serp = {h.get("serp_api_id"): h for h in tracked_hotels if h.get("serp_api_id")}
        tracked_by_name = {h["name"].lower(): h for h in tracked_hotels}

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
                 lat = matched_meta.get("latitude") if lat is None else lat
                 lng = matched_meta.get("longitude") if lng is None else lng
            
            # Final Fallback to District Center if still None (District-Aware Kaizen)
            if (lat is None or lng is None) and city and city.lower() == "balikesir":
                 loc_str = (dh.get("location") or "").lower()
                 name_str = dh["name"].lower()
                 
                 # Ayvalik / Cunda (West Coast)
                 if "ayvalik" in loc_str or "cunda" in loc_str or "küçükköy" in loc_str:
                     lat_base, lng_base = 39.3197, 26.6908
                 # Edremit / Akcay / Altinoluk (North Coast)
                 elif "edremit" in loc_str or "akcay" in loc_str or "altinoluk" in loc_str or "akçay" in loc_str:
                     lat_base, lng_base = 39.5852, 26.9248
                 # Default Balikesir Center (Inland)
                 else:
                     lat_base, lng_base = 39.6482, 27.8826
                 
                 # Add small jitter for visual distribution (0.03 ~ 3.3km)
                 lat = lat_base + (random.random() - 0.5) * 0.03
                 lng = lng_base + (random.random() - 0.5) * 0.03

            hotels_out.append({
                "id": str(dh["id"]),
                "name": dh["name"],
                "location": dh.get("location", "Unknown"),
                "latest_price": float(latest_price),
                "latitude": lat,
                "longitude": lng,
                "rating": dh.get("rating"),
                "serp_api_id": dh.get("serp_api_id"),
            })

        # EXPLANATION: Master Summary Statistics
        # Requirement: Populate the top 4 stat cards in AnalyticsPanel.
        prices = [h["latest_price"] for h in hotels_out if h["latest_price"] and h["latest_price"] > 0]
        avg_price = round(sum(prices) / len(prices), 2) if prices else 0
        price_range = [min(prices), max(prices)] if prices else [0, 0]
        with_price_count = len(prices)
        total_count = len(hotels_out)
        scan_coverage = round((with_price_count / total_count) * 100, 1) if total_count > 0 else 0

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
                vis_query = db.table("price_logs") \
                    .select("recorded_at, search_rank, price") \
                    .in_("hotel_id", hotel_ids_for_vis) \
                    .gte("recorded_at", thirty_days_ago) \
                    .order("recorded_at", desc=False) \
                    .execute()
                
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
                        if d not in by_date: by_date[d] = []
                        by_date[d].append(e)
                    
                    for d, entries in by_date.items():
                        # Sort by price ascending (cheapest = rank 1)
                        sorted_entries = sorted(entries, key=lambda x: x.get("price", 999999))
                        for i, e in enumerate(sorted_entries):
                            e["search_rank"] = i + 1 # Assign rank 1, 2, 3...
                
                for entry in raw_vis:
                    # KAİZEN: Explicit None check for search_rank
                    val_rank = entry.get("search_rank")
                    if val_rank is None or not entry.get("recorded_at"):
                        continue
                    
                    # Normalize date to YYYY-MM-DD for Recharts binding
                    dt_str = entry["recorded_at"].split("T")[0]
                    if dt_str not in daily_aggregates:
                        daily_aggregates[dt_str] = {"sum_rank": 0, "count": 0, "sum_price": 0}
                    
                    daily_aggregates[dt_str]["sum_rank"] += float(val_rank)
                    daily_aggregates[dt_str]["sum_price"] += entry.get("price", 0)
                    daily_aggregates[dt_str]["count"] += 1
                
                for date_key in sorted(daily_aggregates.keys()):
                    agg = daily_aggregates[date_key]
                    visibility_data.append({
                        "date": date_key,
                        "rank": round(agg["sum_rank"] / agg["count"], 1),
                        "price": round(agg["sum_price"] / agg["count"], 2)
                    })
        except Exception as e:
            print(f"Visibility Aggregation Error: {e}")

        # KAİZEN: Dynamic Currency Detection
        # Instead of hardcoding '$', we detect the currency used in the most recent scans.
        detected_currency = "TRY"
        try:
            hotel_ids_for_curr = [str(h["id"]) for h in tracked_hotels]
            if hotel_ids_for_curr:
                curr_res = db.table("price_logs") \
                    .select("currency") \
                    .in_("hotel_id", hotel_ids_for_curr) \
                    .not_.is_("currency", "null") \
                    .limit(1) \
                    .execute()
                if curr_res.data:
                    detected_currency = curr_res.data[0].get("currency", "TRY")
        except:
            pass

        # EXPLANATION: Competitive Network Generation
        # Requirement: "Competitive Clusters" section expects nodes/links.
        # Logic: We take top 15 hotels by price and link each to its two closest price neighbors.
        priced_subset = sorted([h for h in hotels_out if h["latest_price"] > 0], 
                              key=lambda x: x["latest_price"], reverse=True)[:15]
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
            if is_main: has_target = True
            
            nodes.append({
                "id": hid,
                "label": h["name"],
                "value": float(h["latest_price"]),
                "type": "target" if is_main else "competitor"
            })
        
        # Build links between adjacent priced hotels
        for i in range(len(priced_subset)):
            if i + 1 < len(priced_subset):
                 links.append({
                     "source": priced_subset[i]["id"],
                     "target": priced_subset[i+1]["id"],
                     "label": "Price Rival"
                 })
            if i + 2 < len(priced_subset):
                 links.append({
                     "source": priced_subset[i]["id"],
                     "target": priced_subset[i+2]["id"],
                     "label": "Market Tier"
                 })

        return {
            "hotels": hotels_out,
            "visibility": visibility_data,
            "network": {
                "nodes": nodes,
                "links": links
            },
            "summary": {
                "hotel_count": total_count,
                "avg_price": avg_price,
                "price_range": price_range,
                "scan_coverage_pct": scan_coverage,
                "currency": detected_currency,
                "currency_symbol": "₺" if detected_currency == "TRY" else "$"
            }
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
            }
        }


async def get_scheduler_queue_logic(db: Client) -> List[Dict[str, Any]]:
    """
    Fetch all users who have scheduled scans (next_scan_at set in profiles).
    
    EXPLANATION: Scheduler Queue for Admin Panel
    The ScansPanel 'Upcoming Queue' tab calls /api/admin/scheduler/queue but this
    endpoint was never implemented. This function queries the profiles table for
    users with next_scan_at set, enriches with frequency from settings, hotel 
    names from hotels table, and display name from user_profiles.
    """
    try:
        now = datetime.now(timezone.utc)
        
        # 1. Fetch all profiles that have a next_scan_at (these are scheduled users)
        profiles_res = db.table("profiles") \
            .select("id, next_scan_at, scan_frequency_minutes") \
            .not_.is_("next_scan_at", "null") \
            .execute()
        profiles = profiles_res.data or []
        
        if not profiles:
            return []
        
        user_ids = [p["id"] for p in profiles]
        
        # 2. Fetch display names from user_profiles
        names_res = db.table("user_profiles") \
            .select("user_id, display_name, email") \
            .in_("user_id", user_ids) \
            .execute()
        names_map = {
            n["user_id"]: n.get("display_name") or n.get("email", "Unknown")
            for n in (names_res.data or [])
        }
        
        # 3. Fetch settings for check_frequency_minutes (authoritative source)
        settings_res = db.table("settings") \
            .select("user_id, check_frequency_minutes") \
            .in_("user_id", user_ids) \
            .execute()
        settings_map = {
            s["user_id"]: s.get("check_frequency_minutes", 0)
            for s in (settings_res.data or [])
        }
        
        # 4. Fetch hotel names per user
        hotels_res = db.table("hotels") \
            .select("user_id, name") \
            .in_("user_id", user_ids) \
            .execute()
        hotels_map: Dict[str, List[str]] = {}
        for h in (hotels_res.data or []):
            uid = h["user_id"]
            if uid not in hotels_map:
                hotels_map[uid] = []
            hotels_map[uid].append(h["name"])
        
        # 5. Fetch last completed scan per user for last_scan_at
        last_scan_map: Dict[str, str] = {}
        for uid in user_ids:
            try:
                scan_res = db.table("scan_sessions") \
                    .select("completed_at") \
                    .eq("user_id", uid) \
                    .eq("status", "completed") \
                    .order("completed_at", desc=True) \
                    .limit(1) \
                    .execute()
                if scan_res.data:
                    last_scan_map[uid] = scan_res.data[0]["completed_at"]
            except Exception:
                pass
        
        # 6. Build queue entries
        queue = []
        for p in profiles:
            uid = p["id"]
            next_scan = p.get("next_scan_at")
            if not next_scan:
                continue
            
            # Determine frequency: settings is authoritative, fallback to profiles
            freq = settings_map.get(uid, p.get("scan_frequency_minutes", 0))
            if not freq or freq <= 0:
                continue  # Not actually scheduled
            
            # Determine status
            try:
                next_dt = datetime.fromisoformat(next_scan.replace("Z", "+00:00"))
                status = "overdue" if next_dt <= now else "pending"
            except Exception:
                status = "pending"
            
            hotels_list = hotels_map.get(uid, [])
            
            queue.append({
                "user_id": uid,
                "user_name": names_map.get(uid, "Unknown"),
                "scan_frequency_minutes": freq,
                "last_scan_at": last_scan_map.get(uid),
                "next_scan_at": next_scan,
                "status": status,
                "hotel_count": len(hotels_list),
                "hotels": hotels_list[:5],  # Limit to first 5 names for display
            })
        
        # Sort: overdue first, then by next_scan_at ascending
        queue.sort(key=lambda x: (0 if x["status"] == "overdue" else 1, x["next_scan_at"]))
        
        return queue
    except Exception as e:
        print(f"Admin Scheduler Queue Error: {e}")
        traceback.print_exc()
        return []


async def update_admin_settings_logic(updates: AdminSettingsUpdate, db: Client) -> AdminSettings:
    """Update global settings."""
    current = await get_admin_settings_logic(db)
    update_data = updates.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data_to_upsert = {**current.model_dump(), **update_data, "id": str(current.id)}
    res = db.table("admin_settings").upsert(data_to_upsert).execute()
    return AdminSettings(**res.data[0]) if res.data else current.model_copy(update=update_data)

async def trigger_all_overdue_logic() -> Dict[str, Any]:
    """
    Manually triggers the background scheduler loop.
    Finds all users who are currently due/overdue and triggers their scans.
    """
    try:
        from backend.services.monitor_service import run_scheduler_check_logic
        await run_scheduler_check_logic()
        return {"status": "success", "message": "All overdue scans triggered successfully."}
    except Exception as e:
        print(f"Trigger All Overdue Error: {e}")
        return {"error": str(e)}

async def cleanup_empty_scans_logic(db: Client) -> Dict[str, Any]:
    """
    Identifies and removes scan sessions that have no results.
    Criteria:
    - Status is 'failed'
    - Status is 'completed' or 'partial' but resulted in 0 successful price logs.
    """
    try:
        # 1. Get all failed sessions
        failed_res = db.table("scan_sessions").select("id").eq("status", "failed").execute()
        failed_ids = [s["id"] for s in (failed_res.data or [])]
        
        # 2. Get all completed/partial sessions and check their result count
        # This is more intensive, so we limit to last 7 days for safety
        cutoff = (datetime.now() - timedelta(days=7)).isoformat()
        sessions_res = db.table("scan_sessions") \
            .select("id") \
            .in_("status", ["completed", "partial"]) \
            .gte("created_at", cutoff) \
            .execute()
        
        potential_empty_ids = [s["id"] for s in (sessions_res.data or [])]
        empty_ids = []
        
        for sid in potential_empty_ids:
            # Check if there are any successful logs for this session
            logs_res = db.table("price_logs").select("id", count="exact").eq("session_id", sid).execute()
            if logs_res.count == 0:
                empty_ids.append(sid)
        
        all_to_delete = list(set(failed_ids + empty_ids))
        
        if not all_to_delete:
            return {"status": "success", "count": 0, "message": "No empty scans found to clean up."}
            
        # 3. Delete sessions
        db.table("scan_sessions").delete().in_("id", all_to_delete).execute()
        
        return {
            "status": "success", 
            "count": len(all_to_delete), 
            "message": f"Successfully removed {len(all_to_delete)} empty or failed scan sessions."
        }
    except Exception as e:
        print(f"Cleanup Empty Scans Error: {e}")
        return {"error": str(e)}
