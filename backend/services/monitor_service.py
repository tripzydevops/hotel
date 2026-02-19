"""
Monitor Service.
Orchestrates the asynchronous background AI Agent-Mesh for price monitoring.
"""
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

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
        logger.error(f"Limit check exception: {e}")

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
        logger.error(f"Session creation failed: {e}")

    # Normalized Options for Background task
    normalized_options = ScanOptions(
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        currency=currency
    )

    # 4. Background Execution (Celery)
    # Hybrid Architecture: Vercel (API) -> Redis -> VM (Celery Worker)
    from backend.tasks import run_scan_task
    
    # We serialize complex objects to basic types for JSON transport
    task_args = {
        "user_id": str(user_id),
        "hotels": hotels, # Already dicts
        "options_dict": normalized_options.model_dump() if normalized_options else None,
        "session_id": str(session_id) if session_id else None
    }
    
    # Dispatch to Redis
    run_scan_task.delay(**task_args)
    logger.info(f"Dispatched Celery task for session {session_id}")

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
        logger.info(f"Starting ScraperAgent for {len(hotels)} hotels...")
        scraper_results = await scraper.run_scan(user_id, hotels, options, session_id)

        # 4. Phase 2: Analyst Agent
        logger.info("Starting AnalystAgent...")
        analysis = await analyst.analyze_results(user_id, scraper_results, threshold, options=options, session_id=session_id)

        # 4.5 Room Type Cataloging
        try:
            from backend.services.room_type_service import update_room_type_catalog
            await update_room_type_catalog(db, scraper_results, hotels)
        except Exception as e:
            logger.warning(f"Room Catalog failure: {e}")

        # 5. Phase 3: Notifier Agent
        if analysis.get("alerts"):
            try:
                settings_res = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
                settings = settings_res.data[0] if settings_res.data else None
                if settings:
                    hotel_name_map = {h["id"]: h["name"] for h in hotels}
                    await notifier.dispatch_alerts(analysis["alerts"], settings, hotel_name_map)
            except Exception as e:
                logger.warning(f"Notifier failure: {e}")

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
        logger.critical(f"SYSTEM FAILURE: {e}")
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
    logger.info(f"CRON: Starting scheduler check...")
    from backend.utils.db import get_supabase
    try:
        supabase = get_supabase()
        if not supabase:
            logger.error("CRON: Database unavailable")
            return

        # 1. Get all active users with schedules due
        # KAİZEN: Robust ISO format for Supabase comparison (YYYY-MM-DDTHH:MM:SSZ)
        now_dt = datetime.now(timezone.utc).replace(microsecond=0)
        now_iso = now_dt.isoformat().replace("+00:00", "Z")
        logger.info(f"CRON: Checking for scans due before {now_iso}")
        
        # 1.1 Fetch all active profiles
        result = supabase.table("profiles").select("id, next_scan_at, scan_frequency_minutes, subscription_status") \
            .lte("next_scan_at", now_iso) \
            .eq("subscription_status", "active") \
            .execute()
        
        active_due = result.data or []
        logger.info(f"CRON: Found {len(active_due)} active profiles due for scan.")
        
        if not active_due:
            return

        # 1.2 Fetch actual user settings for frequency override
        due_ids = [u['id'] for u in active_due]
        settings_res = supabase.table("settings").select("user_id, check_frequency_minutes").in_("user_id", due_ids).execute()
        settings_map = {s['user_id']: s['check_frequency_minutes'] for s in settings_res.data or []}

        # 1.3 Pool all hotels
        hotels_res = supabase.table("hotels").select("*").in_("user_id", due_ids).execute()
        all_hotels = hotels_res.data or []
        
        # Group hotels by user for processing
        user_hotels_map = {}
        for h in all_hotels:
            uid = h['user_id']
            if uid not in user_hotels_map:
                user_hotels_map[uid] = []
            user_hotels_map[uid].append(h)

        for user in active_due:
            try:
                user_id = user['id']
                logger.info(f"Processing user {user_id}...")

                # 2. Update next_scan_at immediately (Locking mechanism)
                # KAİZEN: Prioritize 'settings.check_frequency_minutes' over 'profiles.scan_frequency_minutes'
                freq = settings_map.get(user_id) or user.get("scan_frequency_minutes") or 1440 
                next_run_dt = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=freq)
                next_run_iso = next_run_dt.isoformat().replace("+00:00", "Z")
                
                supabase.table("profiles").update({"next_scan_at": next_run_iso}).eq("id", user_id).execute()
                logger.info(f"User {user_id}: Updated next_scan_at to {next_run_iso} (freq={freq}m)")
                
                # 3. Trigger Background Orchestrator
                hotels = user_hotels_map.get(user_id, [])
                if hotels:
                    # [Global Pulse] These background tasks will run in parallel.
                    # Because ScraperAgent has a 60m cache check, multiple users 
                    # tracking the same hotel will now automatically share the same 
                    # scan result if they are triggered in the same cron window.
                    await run_monitor_background(
                        user_id=UUID(user_id),
                        hotels=hotels,
                        options=None,
                        db=supabase,
                        session_id=None
                    )
                
                logger.info(f"Batch trigger completed for user {user_id}")
                
            except Exception as u_e:
                logger.error(f"Error processing user {user.get('id')}: {u_e}")
                
    except Exception as e:
        logger.critical(f"CRON ERROR: {e}")
        traceback.print_exc()
