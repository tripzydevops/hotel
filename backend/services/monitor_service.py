"""
Monitor Service.
Orchestrates the asynchronous background AI Agent-Mesh for price monitoring.
"""

import os
import traceback
from datetime import datetime, date, timezone, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import BackgroundTasks, HTTPException
from supabase import Client

from backend.models.schemas import ScanOptions, MonitorResult
from backend.agents.scraper_agent import ScraperAgent
from backend.agents.analyst_agent import AnalystAgent
from backend.agents.notifier_agent import NotifierAgent

async def trigger_monitor_logic(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    options: Optional[ScanOptions],
    db: Client,
    current_user_id: str,
    current_user_email: Optional[str]
) -> MonitorResult:
    """
    Main trigger for price monitoring.
    Enforces limits, normalizes dates, and launches the background orchestrator.
    
    Reminder Note: Standard users are limited to daily manual scan quotas.
    Enterprise users have unlimited background agent cycles.
    """
    
    # Get all hotels for user
    hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    hotels = hotels_result.data or []
    
    if not hotels:
        return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0)
        
    # 1. ADMIN BYPASS / LIMIT ENFORCEMENT
    try:
        is_admin = False
        profile_res = db.table("user_profiles").select("role").eq("user_id", str(current_user_id)).execute()
        if profile_res.data and profile_res.data[0].get("role") in ["admin", "market_admin", "market admin"]:
            is_admin = True

        if not is_admin:
            # Enforce Limits
            plan_type = "starter"
            profiles_res = db.table("profiles").select("plan_type").eq("id", str(user_id)).execute()
            if profiles_res.data:
                plan_type = profiles_res.data[0].get("plan_type", "starter")
            
            # Fetch tier config
            tier_res = db.table("tier_configs").select("manual_scans_per_day").eq("plan_type", plan_type).execute()
            daily_manual_limit = tier_res.data[0].get("manual_scans_per_day", 0) if tier_res.data else 0
            
            # Legacy monthly limit
            plan_res = db.table("plans").select("monthly_scan_limit").eq("name", plan_type).execute()
            monthly_total_limit = plan_res.data[0].get("monthly_scan_limit", 500) if plan_res.data else 500
            
            # Recent scan counts
            today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
            daily_manual_res = db.table("scan_sessions").select("id", count="exact").eq("user_id", str(user_id)).eq("session_type", "manual").gte("created_at", today_start).execute()
            current_daily_manual = daily_manual_res.count or 0
            
            first_day = datetime(datetime.now().year, datetime.now().month, 1).isoformat()
            monthly_total_res = db.table("scan_sessions").select("id", count="exact").eq("user_id", str(user_id)).gte("created_at", first_day).execute()
            current_monthly_total = monthly_total_res.count or 0
            
            if daily_manual_limit <= 0:
                return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=["MANUAL_SCAN_RESTRICTED"])

            if current_daily_manual >= daily_manual_limit:
                return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=[f"DAILY_LIMIT_REACHED ({daily_manual_limit})"])
                
            if current_monthly_total >= monthly_total_limit:
                 return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=[f"MONTHLY_LIMIT_REACHED ({monthly_total_limit})"])
            
    except Exception as e:
        print(f"Monitor: Limit check exception: {e}")

    # 2. DEFAULT DATES NORMALIZATION
    check_in = options.check_in if options and options.check_in else None
    check_out = options.check_out if options and options.check_out else None
    
    today = date.today()
    if (not check_in) or (str(check_in) == str(today)):
        # Late night advances for Google Travel reliability
        if datetime.now().hour >= 18:
            check_in = today + timedelta(days=1)
    
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
        session_result = db.table("scan_sessions").insert({
            "user_id": str(user_id),
            "session_type": "manual",
            "hotels_count": len(hotels),
            "status": "pending",
            "check_in_date": str(check_in),
            "check_out_date": str(check_out),
            "adults": adults,
            "currency": currency
        }).execute()
        if session_result.data:
            session_id = session_result.data[0]["id"]
    except Exception as e:
        print(f"Monitor: Session creation failed: {e}")

    # Normalized Options for Background task
    normalized_options = ScanOptions(
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        currency=currency
    )

    # 4. Background Execution
    background_tasks.add_task(
        run_monitor_background,
        user_id=user_id,
        hotels=hotels,
        options=normalized_options,
        db=db,
        session_id=session_id
    )

    return MonitorResult(
        hotels_checked=len(hotels),
        prices_updated=0,
        alerts_generated=0,
        session_id=UUID(session_id) if session_id else None,
        errors=[]
    )

async def run_monitor_background(
    user_id: UUID,
    hotels: List[Dict[str, Any]],
    options: Optional[ScanOptions],
    db: Client,
    session_id: Optional[UUID]
):
    """
    Background orchestrator. Mission Control for specialized AI agents.
    """
    try:
        # 1. Initialize Agents
        scraper = ScraperAgent(db)
        analyst = AnalystAgent(db)
        notifier = NotifierAgent()

        # 2. Get User Threshold
        threshold = 2.0
        try:
            settings_res = db.table("settings").select("threshold_percent").eq("user_id", str(user_id)).execute()
            if settings_res.data:
                threshold = settings_res.data[0].get("threshold_percent", 2.0)
        except Exception: pass

        # 3. Phase 1: Scraper Agent
        print(f"[MissionControl] Starting ScraperAgent for {len(hotels)} hotels...")
        scraper_results = await scraper.run_scan(user_id, hotels, options, session_id)

        # 4. Phase 2: Analyst Agent
        print("[MissionControl] Starting AnalystAgent...")
        analysis = await analyst.analyze_results(user_id, scraper_results, threshold, options=options, session_id=session_id)

        # 4.5 Room Type Cataloging
        try:
            from backend.services.room_type_service import update_room_type_catalog
            await update_room_type_catalog(db, scraper_results, hotels)
        except Exception as e:
            print(f"[MissionControl] Room Catalog failure: {e}")

        # 5. Phase 3: Notifier Agent
        if analysis.get("alerts"):
            try:
                settings_res = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
                settings = settings_res.data[0] if settings_res.data else None
                if settings:
                    hotel_name_map = {h["id"]: h["name"] for h in hotels}
                    await notifier.dispatch_alerts(analysis["alerts"], settings, hotel_name_map)
            except Exception as e:
                print(f"[MissionControl] Notifier failure: {e}")

        # 6. Finalize Session
        final_status = "completed"
        if any(res.get("status") != "success" for res in scraper_results):
            final_status = "partial"
        
        if session_id:
            db.table("scan_sessions").update({
                "status": final_status,
                "completed_at": datetime.now().isoformat()
            }).eq("id", str(session_id)).execute()

    except Exception as e:
        print(f"[MissionControl] CRITICAL SYSTEM FAILURE: {e}")
        traceback.print_exc()
        if session_id:
            try:
                db.table("scan_sessions").update({
                    "status": "failed",
                    "completed_at": datetime.now().isoformat()
                }).eq("id", str(session_id)).execute()
            except: pass

async def run_scheduler_check_logic():
    """
    Internal logic to check all users for due scans and trigger them.
    Ported from main.py for modularity.
    """
    print(f"[{datetime.now()}] CRON: Starting scheduler check...")
    from backend.utils.db import get_supabase
    try:
        supabase = get_supabase()
        if not supabase:
            print("CRON Error: Database unavailable")
            return

        # 1. Get all active users with schedules due
        # Assuming 'profiles' has 'next_scan_at' and 'scan_frequency_minutes'
        result = supabase.table("profiles").select("id, next_scan_at, scan_frequency_minutes, subscription_status") \
            .lte("next_scan_at", datetime.now(timezone.utc).isoformat()) \
            .eq("subscription_status", "active") \
            .execute()
        
        due_users = result.data or []
        print(f"[{datetime.now()}] CRON: Found {len(due_users)} users due for scan.")
        
        for user in due_users:
            try:
                user_id = user['id']
                print(f" - Processing user {user_id}...")

                # 2. Update next_scan_at immediately (Locking mechanism)
                freq = user.get("scan_frequency_minutes") or 1440 
                next_run = datetime.now(timezone.utc) + timedelta(minutes=freq)
                
                supabase.table("profiles").update({"next_scan_at": next_run.isoformat()}).eq("id", user_id).execute()
                
                # 3. Trigger Scraper Agent
                # Directly using ScraperAgent if already imported at top
                scraper = ScraperAgent(supabase)
                # Note: run_full_scan might need to be implemented or use run_scan with defaults
                # For now, we reuse the existing background orchestrator if possible
                # Or just call scraper.run_scan directly if that's what main.py did
                
                # If the ScraperAgent has run_full_scan, use it. Otherwise, we might need a wrapper.
                if hasattr(scraper, 'run_full_scan'):
                    await scraper.run_full_scan()
                else:
                    # Fallback to fetching hotels and triggering background task
                    hotels_res = supabase.table("hotels").select("*").eq("user_id", user_id).execute()
                    hotels = hotels_res.data or []
                    if hotels:
                        await run_monitor_background(
                            user_id=UUID(user_id),
                            hotels=hotels,
                            options=None,
                            db=supabase,
                            session_id=None
                        )
                
                print(f" - Scan completed for user {user_id}")
                
            except Exception as u_e:
                print(f" - Error processing user {user.get('id')}: {u_e}")
                
    except Exception as e:
        print(f"CRON ERROR: {e}")
        traceback.print_exc()
