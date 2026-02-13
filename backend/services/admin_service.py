"""
Admin Service.
Handles system-wide operations, manual directory syncs, user administration,
and system-level reporting.
"""

import os
import time
import traceback
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import HTTPException
from supabase import create_client, Client

from backend.models.schemas import (
    AdminStats, AdminUser, AdminUserCreate, AdminUserUpdate, AdminDirectoryEntry, 
    AdminLog, AdminSettings, AdminSettingsUpdate, SchedulerQueueEntry,
    PlanCreate, PlanUpdate
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
            
        return AdminStats(
            total_users=users_count,
            total_hotels=hotels_count,
            total_scans=scans_count,
            api_calls_today=api_calls,
            directory_size=directory_count,
            service_role_active="SUPABASE_SERVICE_ROLE_KEY" in os.environ
        )
    except Exception as e:
        print(f"Admin Stats Error: {e}")
        raise HTTPException(status_code=500, detail=f"Admin Data Error: {str(e)}")

async def get_api_key_status_logic(db: Client) -> Dict[str, Any]:
    """Get status of SerpApi keys for monitoring quota usage."""
    try:
        status = serpapi_client.get_key_status()
        
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
        
        detailed = serpapi_client.get_detailed_status()
        status["keys_status"] = detailed.get("keys_status", [])
        status["env_debug"] = {
            "SERPAPI_API_KEY": "Set" if os.getenv("SERPAPI_API_KEY") else "Missing",
            "SERPAPI_API_KEY_2": "Set" if os.getenv("SERPAPI_API_KEY_2") else "Missing",
            "SERPAPI_API_KEY_3": "Set" if os.getenv("SERPAPI_API_KEY_3") else "Missing"
        }
        return status
    except Exception as e:
        print(f"API Key Status Error: {e}")
        return {"error": str(e), "total_keys": 0, "active_keys": 0}

async def force_rotate_api_key_logic() -> Dict[str, Any]:
    """Force rotate to next API key."""
    try:
        success = serpapi_client._key_manager.rotate_key("manual_rotation")
        return {
            "status": "success" if success else "failed",
            "message": "Rotated to next key" if success else "No available keys",
            "current_status": serpapi_client.get_key_status()
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
                
                final_users.append(AdminUser(**udata))
            except Exception:
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
    """Delete hotel and price logs."""
    db.table("price_logs").delete().eq("hotel_id", hotel_id).execute()
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
        sessions_res = db.table("scan_sessions") \
            .select("*") \
            .eq("user_id", str(user_id)) \
            .order("created_at", desc=True) \
            .limit(100) \
            .execute()
        
        filtered = [s for s in (sessions_res.data or []) if (s.get("hotels_count") or 0) > 0]
        
        summary = {
            "total_scans": len(filtered),
            "system_health": "100%"
        }
        
        return JSONResponse(content=jsonable_encoder({
            "sessions": filtered,
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

async def update_admin_settings_logic(updates: AdminSettingsUpdate, db: Client) -> AdminSettings:
    """Update global settings."""
    current = await get_admin_settings_logic(db)
    update_data = updates.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data_to_upsert = {**current.model_dump(), **update_data, "id": str(current.id)}
    res = db.table("admin_settings").upsert(data_to_upsert).execute()
    return AdminSettings(**res.data[0]) if res.data else current.model_copy(update=update_data)
