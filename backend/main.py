"""
Hotel Rate Monitor - FastAPI Backend
Main application with monitoring and API endpoints.
"""

import os
import asyncio
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone, timedelta
from uuid import UUID
from dotenv import load_dotenv
# Load environment variables from .env and .env.local (Vercel style)
load_dotenv()
load_dotenv(".env.local", override=True)
from supabase import create_client, Client
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from backend.models.schemas import (
    Hotel, HotelCreate, HotelUpdate,
    PriceLog, PriceLogCreate,
    Settings, SettingsUpdate,
    Alert, AlertCreate,
    DashboardResponse, HotelWithPrice, MonitorResult,
    TrendDirection, QueryLog, PricePoint,
    MarketAnalysis, ReportsResponse, ScanSession, ScanOptions,
    UserProfile, UserProfileUpdate,
    PlanCreate, PlanUpdate, MembershipPlan,
    LocationRegistry,
    # Admin Models
    AdminStats, AdminUserCreate, AdminUser, AdminDirectoryEntry, 
    AdminLog, AdminDataResponse, AdminSettings, AdminSettingsUpdate
)
# Fix: explicit imports to avoid module/instance shadowing
from backend.services.serpapi_client import serpapi_client
from backend.services.price_comparator import price_comparator
from backend.services.notification_service import notification_service
from backend.services.location_service import LocationService
from backend.services.provider_factory import ProviderFactory

# Import New Agents
from backend.agents.scraper_agent import ScraperAgent
from backend.agents.analyst_agent import AnalystAgent
from backend.agents.notifier_agent import NotifierAgent

# Import Helpers
from backend.utils.helpers import convert_currency, log_query

# Initialize FastAPI
app = FastAPI(
    title="Hotel Rate Monitor API",
    description="API for monitoring hotel competitor pricing",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"VALIDATION ERROR: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

@app.get("/api/ping")
async def ping():
    return {"status": "pong"}

@app.get("/api/admin/debug-providers")
async def debug_providers():
    """Diagnostic endpoint to see what the live process is actually using."""
    providers = ProviderFactory.get_active_providers()
    return {
        "active_providers": [p.get_provider_name() for p in providers],
        "registered_count": len(providers),
        "primary_provider": providers[0].get_provider_name() if providers else "None",
        "env_check": {
            "SERPAPI": bool(os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")),
            "RAPIDAPI": bool(os.getenv("RAPIDAPI_KEY")),
        }
    }

# Supabase client
def get_supabase() -> Client:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    try:
        if not url or not key:
            print("WARNING: Supabase credentials missing. Returning None client.")
            return None
        return create_client(url, key)
    except Exception as e:
        print(f"Error creating Supabase client: {e}")
        return None


# ===== Security Dependencies =====

async def get_current_admin_user(request: Request, db: Client = Depends(get_supabase)):
    """
    Verify that the request is made by an Admin.
    We check the Authorization header (JWT) via Supabase Auth.
    Then we check the 'role' claim or a whitelist in metadata.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
         print("Admin Auth: Missing Header")
         raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    try:
        # Expected format: "Bearer <token>"
        token_parts = auth_header.split(" ")
        if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
             raise HTTPException(status_code=401, detail="Invalid Token Format")
             
        token = token_parts[1]
        
        # Call Supabase to verify token
        try:
            user_resp = db.auth.get_user(token)
            if not user_resp or not user_resp.user:
                print(f"Admin Auth: Supabase rejected token. Response: {user_resp}")
                raise HTTPException(status_code=401, detail="Supabase: Invalid Token")
            user_obj = user_resp.user
        except Exception as auth_e:
            print(f"Admin Auth: Supabase get_user exception: {auth_e}")
            raise HTTPException(status_code=401, detail=f"Supabase Auth Error: {str(auth_e)}")
            
        user_id = user_obj.id
        email = user_obj.email
        
        print(f"Admin Auth: Verified {email} ({user_id})")

        # 1. Check strict whitelist (Hardcoded for MVP safety)
        if email and (email in ["admin@hotel.plus", "selcuk@rate-sentinel.com"] or email.endswith("@hotel.plus")):
            print(f"Admin Auth: {email} allowed via Whitelist")
            return user_obj
            
        if not db:
             print("Admin Auth: DB Client is None")
             return None # Fallback for safety

        # 2. Check Database Role
        # Use limit(1) instead of single() to avoid crash if no profile
        try:
            profile = db.table("user_profiles").select("role").eq("user_id", user_id).limit(1).execute()
            
            if profile.data and profile.data[0].get("role") == "admin":
                print(f"Admin Auth: {email} allowed via DB Role")
                return user_obj
        except Exception as db_e:
            print(f"Admin Auth: DB Profile lookup failed: {db_e}")
            # Fallthrough to block
            
        print(f"Admin Auth: DENIED - User {email} has no admin role")
        raise HTTPException(status_code=403, detail="Admin Access Required")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Admin Auth CRITICAL: {e}")
        # DEBUG: Return actual error to client to debug 401
        raise HTTPException(status_code=401, detail=f"Auth Critical Failure: {str(e)}")

async def get_current_active_user(request: Request, db: Client = Depends(get_supabase)):
    """
    Verify that the user is logged in AND has an active approval status.
    Block access if subscription_status is 'pending_approval' or 'rejected'.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
         raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    try:
        # Expected format: "Bearer <token>"
        token_parts = auth_header.split(" ")
        if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
             raise HTTPException(status_code=401, detail="Invalid Token Format")
             
        token = token_parts[1]
        
        if not db:
            print("Auth Check: DB Client is None (Vercel Env issue?)")
            raise HTTPException(status_code=503, detail="Database Unavailable")

        user_resp = db.auth.get_user(token)
        
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid Session")
            
        user_id = user_resp.user.id
        
        # Consistent Table Check: Use 'profiles' if that's the one we use for settings
        try:
            # Table 'profiles' uses 'id' as the primary key/link to auth.users in some schemas, 
            # while 'user_profiles' uses 'user_id'.
            res = db.table("profiles").select("subscription_status, plan_type").eq("id", str(user_id)).single().execute()
            status = res.data.get("subscription_status") if res.data else "pending_approval"
        except Exception:
            # Fallback to user_profiles
            try:
                res = db.table("user_profiles").select("subscription_status").eq("user_id", str(user_id)).single().execute()
                status = res.data.get("subscription_status") if res.data else "pending_approval"
            except Exception:
                status = "pending_approval"
                
        # BLOCKING LOGIC
        if status in ["suspended", "rejected"]:
            raise HTTPException(status_code=403, detail="Account Suspended/Rejected")

        # For the dashboard, we usually allow 'pending_approval' to see basic UI 
        # but if we want strict blocking, we do:
        # if status == "pending_approval": raise ...

        return user_resp.user
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Auth Check Error: {e}")
        raise HTTPException(status_code=401, detail="Authentication Failed")


# ===== Helpers =====

# helpers are now in backend.utils.helpers


# ===== Health Check =====

@app.get("/api/health")
async def health_check():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    has_key = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
    return {
        "status": "healthy", 
        "supabase_configured": bool(url and has_key),
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.6-hotfix"
    }


# ===== Dashboard Endpoint =====

@app.get("/api/dashboard/{user_id}")
async def get_dashboard(user_id: UUID, db: Optional[Client] = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """Get dashboard data with target hotel and competitors."""
    
    # 0. Core Fallback
    fallback_data = {
        "target_hotel": None,
        "competitors": [],
        "recent_searches": [],
        "scan_history": [],
        "recent_sessions": [],
        "unread_alerts_count": 0,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

    try:
        if not db:
            return JSONResponse(content=fallback_data)

        # 1. Fetch hotels
        try:
            hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
            hotels = hotels_result.data or []
        except Exception as e:
            print(f"Hotels fetch failed: {e}")
            return JSONResponse(content=fallback_data)
        
        if not hotels:
            return JSONResponse(content=fallback_data)

        # 1.1 BATCH FETCH Price Logs for all hotels
        hotel_ids = [str(h["id"]) for h in hotels]
        hotel_prices_map = {}
        try:
            # OPTIMIZATION: Fetch exactly 2 logs per hotel (current & previous)
            # This ensures we fetch only what we need for the dashboard.
            price_limit = len(hotel_ids) * 2
            all_prices_res = db.table("price_logs") \
                .select("*") \
                .in_("hotel_id", hotel_ids) \
                .order("recorded_at", desc=True) \
                .limit(200) \
                .execute()
            
            for p in (all_prices_res.data or []):
                hid = str(p["hotel_id"])
                if hid not in hotel_prices_map:
                    hotel_prices_map[hid] = []
                # Limit to 10 per hotel in memory
                if len(hotel_prices_map[hid]) < 10:
                    hotel_prices_map[hid].append(p)
        except Exception as e:
            print(f"Batch price fetch failed: {e}. Falling back to empty history.")

        target_hotel = None
        competitors = []
        
        for hotel in hotels:
            try:
                hid = str(hotel["id"])
                prices = hotel_prices_map.get(hid, [])
                current_price = prices[0] if prices else None
                previous_price = prices[1] if len(prices) > 1 else None
                
                price_info = None
                if current_price and current_price.get("price") is not None:
                    try:
                        current = float(current_price["price"])
                        curr_currency = current_price.get("currency") or "USD"
                        
                        previous = None
                        if previous_price and previous_price.get("price") is not None:
                            try:
                                raw_prev = float(previous_price["price"])
                                prev_currency = previous_price.get("currency") or "USD"
                                previous = convert_currency(raw_prev, prev_currency, curr_currency)
                            except Exception:
                                previous = None
                        
                        trend_val = "stable"
                        change = 0.0
                        try:
                            t, change = price_comparator.calculate_trend(current, previous)
                            trend_val = t.value if hasattr(t, "value") else str(t)
                        except Exception:
                            pass

                        price_info = {
                            "current_price": current,
                            "previous_price": previous,
                            "currency": curr_currency,
                            "trend": trend_val,
                            "change_percent": change,
                            "recorded_at": current_price.get("recorded_at"),
                            "vendor": current_price.get("vendor"),
                            "check_in": current_price.get("check_in_date"),
                            "check_out": current_price.get("check_out_date"),
                            "adults": current_price.get("adults"),
                            "offers": current_price.get("offers") or [],
                            "room_types": current_price.get("room_types") or []
                        }
                    except Exception as e:
                        print(f"Error building price_info for {hotel.get('name')}: {e}")

                # Safe Price History
                valid_history = []
                for p in prices:
                    try:
                        if p.get("price") is not None:
                            valid_history.append({
                                "price": float(p["price"]), 
                                "recorded_at": p.get("recorded_at")
                            })
                    except Exception:
                        continue

                # Build the hotel dict
                hotel_data = {
                    **hotel,
                    "price_info": price_info,
                    "price_history": valid_history
                }
                
                if hotel.get("is_target_hotel"):
                    target_hotel = hotel_data
                else:
                    competitors.append(hotel_data)
            except Exception as e:
                print(f"Crash in hotel loop for {hotel.get('id')}: {e}")
                continue
        
        # 2. Alerts (Safe)
        unread_count = 0
        try:
            alerts_res = db.table("alerts").select("id", count="exact").eq("user_id", str(user_id)).eq("is_read", False).execute()
            unread_count = alerts_res.count or 0
        except Exception: pass 
        
        # 3. Activity (Safe)
        recent_searches = []
        try:
            recent_res = db.table("query_logs").select("*").eq("user_id", str(user_id)).in_("action_type", ["search", "create"]).order("created_at", desc=True).limit(20).execute()
            seen = set()
            for log in (recent_res.data or []):
                name = log.get("hotel_name")
                if name and name not in seen:
                    recent_searches.append(log)
                    seen.add(name)
                if len(recent_searches) >= 10: break
        except Exception: pass

        scan_history = []
        try:
            scan_res = db.table("query_logs").select("*").eq("user_id", str(user_id)).eq("action_type", "monitor").order("created_at", desc=True).limit(10).execute()
            scan_history = scan_res.data or []
        except Exception: pass

        recent_sessions = []
        try:
            sess_res = db.table("scan_sessions").select("*").eq("user_id", str(user_id)).order("created_at", desc=True).limit(5).execute()
            recent_sessions = sess_res.data or []
        except Exception: pass

        # 4. Final Serialized Response
        final_response = {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "recent_searches": recent_searches,
            "scan_history": scan_history,
            "recent_sessions": recent_sessions,
            "unread_alerts_count": unread_count,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        return JSONResponse(content=jsonable_encoder(final_response))

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"CRITICAL DASHBOARD ERROR: {e}\n{tb}")
        
        # Diagnostics - return full error for debugging (User can check Network tab)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Dashboard Crash",
                "detail": str(e),
                "trace": tb,
                "msg": "Please check backend logs or Network tab in devtools"
            }
        )



# ===== Monitor Endpoint =====

@app.post("/api/monitor/{user_id}", response_model=MonitorResult)
async def trigger_monitor(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    options: ScanOptions = None,
    db: Optional[Client] = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    Trigger price monitoring for all hotels of a user (Asynchronous).
    """
    if not db:
        return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=["DB_UNAVAILABLE"])
        
    # Get all hotels for user
    hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    hotels = hotels_result.data or []
    
    if not hotels:
        return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0)
        
    # ===== ADMIN BYPASS / LIMIT ENFORCEMENT =====
    try:
        # Check Admin Status
        is_admin = False
        email = getattr(current_user, 'email', None)
        
        # 1. Whitelist Check
        if email and (email in ["admin@hotel.plus", "selcuk@rate-sentinel.com"] or email.endswith("@hotel.plus")):
            is_admin = True
        
        # 2. DB Role Check (if not already whitelisted)
        if not is_admin:
            try:
                profile_res = db.table("user_profiles").select("role").eq("user_id", str(current_user.id)).execute()
                if profile_res.data and profile_res.data[0].get("role") == "admin":
                    is_admin = True
            except Exception:
                pass

        if is_admin:
            print(f"[Monitor] Admin Bypass for {email} (User: {user_id})")
        else:
            # ENFORCE LIMITS (Standard/Enterprise Users)
            # 1. Get User Plan Limits from tier_configs
            daily_manual_limit = 0
            monthly_total_limit = 500  # Default
            plan_type = "starter"
            
            profile_res = db.table("profiles").select("plan_type").eq("user_id", str(user_id)).execute()
            if profile_res.data:
                plan_type = profile_res.data[0].get("plan_type", "starter")
                
                # Fetch tier config
                tier_res = db.table("tier_configs").select("manual_scans_per_day").eq("plan_type", plan_type).execute()
                if tier_res.data:
                    daily_manual_limit = tier_res.data[0].get("manual_scans_per_day", 0)
                
                # Legacy plans table check for monthly total
                plan_res = db.table("plans").select("monthly_scan_limit").eq("name", plan_type).execute()
                if plan_res.data:
                    monthly_total_limit = plan_res.data[0].get("monthly_scan_limit", 500)
            
            # 2. Daily Manual Scan Check
            today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
            daily_manual_res = db.table("scan_sessions").select("id", count="exact").eq("user_id", str(user_id)).eq("session_type", "manual").gte("created_at", today_start).execute()
            current_daily_manual = daily_manual_res.count if daily_manual_res.count is not None else 0
            
            # 3. Monthly Total Scan Check
            now = datetime.now()
            first_day = datetime(now.year, now.month, 1).isoformat()
            monthly_total_res = db.table("scan_sessions").select("id", count="exact").eq("user_id", str(user_id)).gte("created_at", first_day).execute()
            current_monthly_total = monthly_total_res.count if monthly_total_res.count is not None else 0
            
            # ACCESS CONTROL: Manual scans restricted to plans with manual_scans_per_day > 0 (Enterprise)
            if daily_manual_limit <= 0:
                return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=["MANUAL_SCAN_RESTRICTED: Manual scans are only available to Enterprise users."])

            # RATE LIMIT: Daily manual scan limit
            if current_daily_manual >= daily_manual_limit:
                return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=[f"DAILY_LIMIT_REACHED: Limit {daily_manual_limit} reached."])
                
            # SAFETY: Monthly total limit
            if current_monthly_total >= monthly_total_limit:
                 return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0, errors=[f"MONTHLY_LIMIT_REACHED: Limit {monthly_total_limit} reached."])
            
    except Exception as e:
        print(f"Limit check failed (allowing pass): {e}")
    # =========================================================
        
    # ===== DEFAULT DATES (RELIABILITY FIX) =====
    check_in = options.check_in if options and options.check_in else None
    check_out = options.check_out if options and options.check_out else None
    
    # Aggressive adjustment: If check_in is 'today' and it's late (after 6 PM UTC), 
    # force it to tomorrow because Google Hotels often lacks same-day results late at night.
    today = date.today()
    is_today = (not check_in) or (check_in == today)
    
    if is_today:
        current_hour = datetime.now().hour
        if current_hour >= 18:
            check_in = today + timedelta(days=1)
            print(f"[Monitor] Late night detected ({current_hour}:00 UTC). Advancing check-in to {check_in}")
        elif not check_in:
            check_in = today
            
    if not check_out:
        check_out = check_in + timedelta(days=1)
    elif check_out <= check_in:
        check_out = check_in + timedelta(days=1)
        
    adults = options.adults if options and options.adults else 2
    currency = options.currency if options and options.currency else "TRY"
    # ==========================================

    # Create session immediately
    session_id = None
    try:
        session_result = db.table("scan_sessions").insert({
            "user_id": str(user_id),
            "session_type": "manual",
            "hotels_count": len(hotels),
            "status": "pending",
            "check_in_date": check_in.isoformat(),
            "check_out_date": check_out.isoformat(),
            "adults": adults,
            "currency": currency
        }).execute()
        if session_result.data:
            session_id = session_result.data[0]["id"]
    except Exception as e:
        print(f"Failed to create session: {e}")

    # Inject normalized options back for the background task
    normalized_options = ScanOptions(
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        currency=currency
    )

    # Launch background task
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
        session_id=session_id,
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
    Background orchestrator for Agent-Mesh monitoring.
    2026 Strategy: main.py acts as the 'Mission Control' for specialized agents.
    """
    errors = []
    try:
        # 1. Initialize Agents
        scraper = ScraperAgent(db)
        analyst = AnalystAgent(db)
        notifier = NotifierAgent()

        # 2. Get User Settings (Threshold for Analyst)
        settings = None
        try:
            settings_res = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
            if settings_res.data:
                settings = settings_res.data[0]
        except Exception: pass
        
        threshold = settings["threshold_percent"] if settings else 2.0

        # 3. Phase 1: Scraper Agent (Data Gathering)
        print(f"[Orchestrator] Triggering ScraperAgent for {len(hotels)} hotels...")
        scraper_results = await scraper.run_scan(user_id, hotels, options, session_id)

        # 4. Phase 2: Analyst Agent (Intelligence & Persistence)
        print(f"[Orchestrator] Triggering AnalystAgent for analysis...")
        analysis = await analyst.analyze_results(user_id, scraper_results, threshold, options=options)

        # 5. Phase 3: Notifier Agent (Communication)
        if analysis["alerts"] and settings:
            print(f"[Orchestrator] Triggering NotifierAgent for {len(analysis['alerts'])} alerts...")
            hotel_name_map = {h["id"]: h["name"] for h in hotels}
            await notifier.dispatch_alerts(analysis["alerts"], settings, hotel_name_map)

        # 6. Finalize Session (Status mapping)
        final_status = "completed"
        # If any hotel failed to return a price, mark as partial
        if any(res["status"] != "success" for res in scraper_results):
            final_status = "partial"
        
        if session_id:
            db.table("scan_sessions").update({
                "status": final_status,
                "completed_at": datetime.now().isoformat()
            }).eq("id", str(session_id)).execute()
            print(f"[Orchestrator] Session {session_id} finalized as {final_status}")

    except Exception as e:
        print(f"[Orchestrator] CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        errors.append(str(e))
        if session_id:
            try:
                db.table("scan_sessions").update({
                    "status": "failed",
                    "completed_at": datetime.now().isoformat()
                }).eq("id", str(session_id)).execute()
            except: pass
# ===== Hotels CRUD =====

@app.get("/api/v1/directory/search")
async def search_hotel_directory(
    q: str, 
    user_id: Optional[UUID] = Query(None), 
    db: Optional[Client] = Depends(get_supabase)
):
    if not q or len(q.strip()) < 2:
        return []

    q_trimmed = q.strip()
    print(f"DEBUG SEARCH: Received query '{q_trimmed}'")
    
    if not db:
        print("DEBUG SEARCH: DB is None")
        return []
    
    try:
        # Local Lookup (Primary)
        # We only search the local directory to avoid draining search API credits.
        # This directory is populated automatically after successful price scans.
        print(f"DEBUG SEARCH: Executing DB query for '{q_trimmed}'")
        result = db.table("hotel_directory") \
            .select("name, location, serp_api_id") \
            .ilike("name", f"%{q_trimmed}%") \
            .limit(5) \
            .execute()
        
        # Log this search if user_id is provided
        if user_id:
            await log_query(
                db=db,
                user_id=user_id,
                hotel_name=q_trimmed,
                location=None,
                action_type="search",
                status="success"
            )
        
        print(f"DEBUG SEARCH: Found {len(result.data)} results")
        return result.data or []
    except Exception as e:
        print(f"Error searching directory: {e}")
        return []


@app.get("/api/hotels/{user_id}", response_model=List[Hotel])
async def list_hotels(user_id: UUID, db: Optional[Client] = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    if not db:
        return []
        
    result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    return result.data or []


# ===== Location Discovery =====

@app.get("/api/locations", response_model=List[LocationRegistry])
async def list_locations(db: Client = Depends(get_supabase)):
    """Fetch all discovered locations for the dropdowns."""
    if not db:
        return []
    service = LocationService(db)
    return await service.get_locations()


@app.post("/api/hotels/{user_id}", response_model=Hotel)
async def create_hotel(user_id: UUID, hotel: HotelCreate, db: Optional[Client] = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable in Dev Mode")
        
    # Check hotel limit (Max 5 for demo) - STRICT ENFORCEMENT
    existing = db.table("hotels").select("id").eq("user_id", str(user_id)).execute()
    if existing.data and len(existing.data) >= 5:
        raise HTTPException(status_code=403, detail="Hotel limit reached (Max 5). Please upgrade to add more.")
        
    
    # Check for duplicates via SerpApi ID
    if hotel.serp_api_id:
        existing = db.table("hotels") \
            .select("*") \
            .eq("user_id", str(user_id)) \
            .eq("serp_api_id", hotel.serp_api_id) \
            .execute()
            
        if existing.data:
            print(f"Duplicate prevented: Hotel {hotel.name} (ID: {hotel.serp_api_id}) already exists.")
            return existing.data[0]

    # If this is a target hotel, unset any existing target
    if hotel.is_target_hotel:
        db.table("hotels") \
            .update({"is_target_hotel": False}) \
            .eq("user_id", str(user_id)) \
            .eq("is_target_hotel", True) \
            .execute()
    
    # Normalize before insert
    hotel_data = hotel.model_dump()
    hotel_data["name"] = hotel_data["name"].title().strip()
    if "location" in hotel_data and hotel_data["location"]:
        hotel_data["location"] = hotel_data["location"].title().strip()

    result = db.table("hotels").insert({
        "user_id": str(user_id),
        **hotel_data,
    }).execute()
    
    # Log the hotel creation as a query event too
    if result.data:
        hotel_inserted = result.data[0]
        await log_query(
            db=db,
            user_id=user_id,
            hotel_name=hotel_data["name"],
            location=hotel_data.get("location"),
            action_type="create"
        )
        
        # Autonomous Location Discovery
        try:
            loc_service = LocationService(db)
            raw_location = hotel_data.get("location", "")
            if raw_location:
                # Basic parsing: "City, Country" or "City"
                parts = [p.strip() for p in raw_location.split(",")]
                city = parts[0]
                country = parts[1] if len(parts) > 1 else (hotel_data.get("preferred_currency", "TRY") == "TRY" and "Turkey" or "Unknown")
                await loc_service.upsert_location(country, city)
        except Exception as loc_e:
            print(f"Location discovery ignored: {loc_e}")
        
        # Mirror to shared directory so it appears in autocomplete for everyone
        try:
            db.table("hotel_directory").upsert({
                "name": hotel_data["name"],
                "location": hotel_data.get("location"),
                "serp_api_id": hotel_data.get("serp_api_id"),
                "last_verified_at": datetime.now().isoformat()
            }, on_conflict="name,location").execute()
        except Exception as e:
            print(f"Directory sync ignored: {e}") # Non-blocking
            
    return result.data[0]


@app.patch("/api/hotels/{hotel_id}")
async def update_hotel(hotel_id: UUID, hotel: HotelUpdate, db: Client = Depends(get_supabase)):
    """Update hotel details."""
    update_data = {k: v for k, v in hotel.model_dump().items() if v is not None}
    
    if not update_data:
        return None

    # Logic: If setting as target, unset other targets for this user
    if update_data.get("is_target_hotel"):
        try:
            # Check ownership first to get user_id
            current_res = db.table("hotels").select("user_id").eq("id", str(hotel_id)).single().execute()
            if current_res.data:
                uid = current_res.data["user_id"]
                db.table("hotels").update({"is_target_hotel": False}).eq("user_id", uid).execute()
        except:
             pass # Fail silent if check fails, logic below will still update this one

    result = db.table("hotels").update(update_data).eq("id", str(hotel_id)).execute()
    return result.data[0] if result.data else None


@app.delete("/api/hotels/{hotel_id}")
async def delete_hotel(hotel_id: UUID, db: Client = Depends(get_supabase)):
    db.table("hotels").delete().eq("id", str(hotel_id)).execute()
    return {"status": "deleted"}

# ===== Settings CRUD =====

@app.get("/api/settings/{user_id}", response_model=Settings)
async def get_settings(user_id: UUID, db: Optional[Client] = Depends(get_supabase)):
    now = datetime.now(timezone.utc)
    # Default safe settings object that matches Pydantic Schema STRICTLY
    safe_defaults = {
        "user_id": str(user_id),
        "threshold_percent": 2.0,
        "check_frequency_minutes": 144,
        "notifications_enabled": True,
        "push_enabled": False,
        "currency": "USD",
        "notification_email": None,
        "whatsapp_number": None,
        "push_subscription": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }

    try:
        if not db:
             return safe_defaults
            
        result = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
        if not result.data:
            # Create default settings if none exist
            # Note: insert usually returns the created object with timestamps
            try:
                # Prepare insert data (exclude readonly fields if needed, but here we explicitly set defaults)
                insert_data = {
                    "user_id": str(user_id),
                    "threshold_percent": 2.0,
                    "check_frequency_minutes": 1440,
                    "notifications_enabled": True,
                    "push_enabled": False,
                    "currency": "USD"
                }
                result = db.table("settings").insert(insert_data).execute()
                return result.data[0]
            except:
                return safe_defaults
        return result.data[0]
    except Exception as e:
        print(f"Error in get_settings: {e}")
        return safe_defaults


@app.put("/api/settings/{user_id}", response_model=Settings)
async def update_settings(user_id: UUID, settings: SettingsUpdate, db: Optional[Client] = Depends(get_supabase)):
    if not db:
        # Return a mock response matching schema so UI doesn't crash
        return {
            "user_id": str(user_id),
            "threshold_percent": settings.threshold_percent,
            "check_frequency_minutes": settings.check_frequency_minutes,
            "notifications_enabled": settings.notifications_enabled,
            "push_enabled": settings.push_enabled,
            "currency": settings.currency,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
    # Check if settings exist
    existing = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
    
    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    
    if not existing.data:
        # Insert
        result = db.table("settings").insert({
            "user_id": str(user_id),
            **update_data
        }).execute()
    else:
        # Update
        result = db.table("settings").update(update_data).eq("user_id", str(user_id)).execute()
        
    return result.data[0] if result.data else None


# ===== User Profile =====

@app.get("/api/profile/{user_id}", response_model=UserProfile)
async def get_profile(user_id: UUID, db: Optional[Client] = Depends(get_supabase)):
    """Get user profile information."""
    # Define check early
    is_dev_user = str(user_id) == "123e4567-e89b-12d3-a456-426614174000"

    if not db:
        # Return default mock profile for dev mode
        return UserProfile(
            user_id=user_id,
            display_name="Demo User",
            company_name="My Hotel",
            job_title="Manager",
            timezone="UTC",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            plan_type="enterprise",
            subscription_status="active"
        )
    
    # Fetch base profile
    result = db.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
    
    # Fetch subscription info (truth source) - Use Service Role to bypass RLS
    try:
        admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        viewer_db = db
        if admin_key and url:
             viewer_db = create_client(url, admin_key)
        
        sub_data = viewer_db.table("profiles").select("plan_type, subscription_status").eq("id", str(user_id)).execute().data
    except Exception as e:
        print(f"Profile Sync Error: {e}")
        sub_data = []
    
    plan = "trial"
    status = "trial"
    if sub_data:
        plan = sub_data[0].get("plan_type") or "trial"
        status = sub_data[0].get("subscription_status") or "trial"
    
    
    # 3. Fallback logic: Use user_profiles data if profiles sync failed
    if not sub_data and result.data:
        # Check if the base profile has the data (from migration backfill or double-write)
        base_plan = result.data[0].get("plan_type")
        base_status = result.data[0].get("subscription_status")
        if base_plan: plan = base_plan
        if base_status: status = base_status

    # Force PRO for Dev/Demo User
    if is_dev_user:
        plan = "enterprise"
        status = "active"

    if result.data:
        p = result.data[0]
        p["plan_type"] = plan
        p["subscription_status"] = status
        return p
    
    # Return a default profile if none exists
    # Force PRO for the Dev/Demo User ID
    
    return UserProfile(
        user_id=user_id,
        display_name="Demo User" if is_dev_user else None,
        company_name="My Hotel" if is_dev_user else None,
        job_title=None,
        timezone="UTC",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        plan_type="enterprise" if is_dev_user else plan,
        subscription_status="active" if is_dev_user else status
    )


@app.put("/api/profile/{user_id}", response_model=UserProfile)
async def update_profile(user_id: UUID, profile: UserProfileUpdate, db: Optional[Client] = Depends(get_supabase)):
    """Update user profile (upsert)."""
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    
    # Check if profile exists
    existing = db.table("user_profiles").select("user_id").eq("user_id", str(user_id)).execute()
    
    if not existing.data:
        # Insert new profile
        result = db.table("user_profiles").insert({
            "user_id": str(user_id),
            **update_data
        }).execute()
    else:
        # Update existing profile
        result = db.table("user_profiles").update(update_data).eq("user_id", str(user_id)).execute()
    
    return result.data[0] if result.data else None


# ===== Alerts =====

@app.get("/api/alerts/{user_id}", response_model=List[Alert])
async def list_alerts(user_id: UUID, unread_only: bool = False, db: Optional[Client] = Depends(get_supabase)):
    if not db:
        return []
    try:
        query = db.table("alerts").select("*").eq("user_id", str(user_id))
        if unread_only:
            query = query.eq("is_read", False)
        result = query.order("created_at", desc=True).limit(50).execute()
        return result.data or []
    except:
        return []


@app.patch("/api/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: UUID, db: Client = Depends(get_supabase)):
    db.table("alerts").update({"is_read": True}).eq("id", str(alert_id)).execute()
    return {"status": "marked_read"}


# ===== Cron / Scheduler =====

@app.get("/api/cron")
async def scheduled_monitor(background_tasks: BackgroundTasks, db: Client = Depends(get_supabase)):
    """
    Cron endpoint triggered by Vercel Cron.
    Iterates all users and checks if it's time to run their monitor.
    """
    # 1. Get all unique users with settings
    # Note: In a real production app, we would paginate this or use a queue.
    # For prototype, fetching all settings is fine.
    settings_result = db.table("settings").select("*").execute()
    all_settings = settings_result.data or []
    
    results = {
        "triggered": 0,
        "skipped": 0,
        "errors": []
    }
    
    for user_setting in all_settings:
        user_id = user_setting["user_id"]
        freq_minutes = user_setting.get("check_frequency_minutes", 0) # Default Manual Only
        
        # 0 means Manual Only
        if freq_minutes <= 0:
            results["skipped"] += 1
            continue
            
        try:
            # Check last update time for this user
            # We check the most recent price log for ANY of their hotels
            # (Assuming all hotels are updated together in a batch)
            hotels_result = db.table("hotels").select("id").eq("user_id", user_id).execute()
            hotel_ids = [h["id"] for h in (hotels_result.data or [])]
            
            if not hotel_ids:
                continue
                
            last_log = db.table("price_logs") \
                .select("recorded_at") \
                .in_("hotel_id", hotel_ids) \
                .order("recorded_at", desc=True) \
                .limit(1) \
                .execute()
                
            should_run = False
            if not last_log.data:
                # No logs yet, run it
                should_run = True
            else:
                last_run_iso = last_log.data[0]["recorded_at"]
                last_run = datetime.fromisoformat(last_run_iso.replace("Z", "+00:00"))
                # Make naive for comparison if needed, or aware
                if last_run.tzinfo is None:
                    last_run = last_run.replace(tzinfo=None)
                
                minutes_since = (datetime.now() - last_run).total_seconds() / 60
                
                if minutes_since >= freq_minutes:
                    should_run = True
            
            if should_run:
                # Call run_monitor_background directly (not via HTTP endpoint)
                # Create session first
                hotels_result = db.table("hotels").select("*").eq("user_id", user_id).execute()
                hotels = hotels_result.data or []
                
                if hotels:
                    session_id = None
                    try:
                        session_result = db.table("scan_sessions").insert({
                            "user_id": user_id,
                            "session_type": "scheduled",
                            "hotels_count": len(hotels),
                            "status": "pending"
                        }).execute()
                        if session_result.data:
                            session_id = session_result.data[0]["id"]
                    except Exception as e:
                        print(f"Cron: Failed to create session for {user_id}: {e}")
                    
                    # Run directly (async)
                    await run_monitor_background(
                        user_id=UUID(user_id),
                        hotels=hotels,
                        check_in=None,
                        db=db,
                        session_id=session_id
                    )
                    results["triggered"] += 1
            else:
                results["skipped"] += 1
                
        except Exception as e:
            print(f"Error in cron for user {user_id}: {e}")
            results["errors"].append(str(e))
            
    return results


@app.post("/api/check-scheduled/{user_id}")
async def check_scheduled_scan(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    db: Optional[Client] = Depends(get_supabase)
):
    """
    Lazy cron workaround for Vercel free tier.
    Called on dashboard load - checks if user's scan is due and triggers if needed.
    """
    if not db:
        return {"triggered": False, "reason": "DB_UNAVAILABLE"}
    
    try:
        # Get user settings
        settings_result = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
        if not settings_result.data:
            return {"triggered": False, "reason": "NO_SETTINGS"}
        
        settings = settings_result.data[0]
        freq_minutes = settings.get("check_frequency_minutes", 0)
        
        if freq_minutes <= 0:
            return {"triggered": False, "reason": "MANUAL_ONLY"}
        
        # Get user's hotels
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        hotels = hotels_result.data or []
        
        if not hotels:
            return {"triggered": False, "reason": "NO_HOTELS"}
        
        hotel_ids = [h["id"] for h in hotels]
        
        # Check last scan time
        last_log = db.table("price_logs") \
            .select("recorded_at") \
            .in_("hotel_id", hotel_ids) \
            .order("recorded_at", desc=True) \
            .limit(1) \
            .execute()
            
        # [Fix: Scan Spam] Check if a scan is ALREADY pending or running in the last 60 mins
        # This prevents loop triggers if the background task is slow or failed silently.
        pending_scan = db.table("scan_sessions") \
            .select("created_at") \
            .eq("user_id", str(user_id)) \
            .in_("status", ["pending", "running"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
            
        if pending_scan.data:
            pending_time = datetime.fromisoformat(pending_scan.data[0]["created_at"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - pending_time).total_seconds() < 3600: # 1 hour timeout
                 return {"triggered": False, "reason": "ALREADY_PENDING"}
        
        should_run = False
        if not last_log.data:
            should_run = True
        else:
            last_run_iso = last_log.data[0]["recorded_at"]
            last_run = datetime.fromisoformat(last_run_iso.replace("Z", "+00:00"))
            minutes_since = (datetime.now(timezone.utc) - last_run).total_seconds() / 60
            
            if minutes_since >= freq_minutes:
                should_run = True
        
        if should_run:
            # Create session
            session_id = None
            try:
                session_result = db.table("scan_sessions").insert({
                    "user_id": str(user_id),
                    "session_type": "scheduled",
                    "hotels_count": len(hotels),
                    "status": "pending"
                }).execute()
                if session_result.data:
                    session_id = session_result.data[0]["id"]
            except Exception as e:
                print(f"LazyScheduler: Failed to create session: {e}")
            
            # Launch in background
            background_tasks.add_task(
                run_monitor_background,
                user_id=user_id,
                hotels=hotels,
                options=None,
                db=db,
                session_id=session_id
            )
            
            return {"triggered": True, "session_id": session_id}
        
        return {"triggered": False, "reason": "NOT_DUE"}
        
    except Exception as e:
        print(f"LazyScheduler error: {e}")
        return {"triggered": False, "reason": str(e)}



@app.post("/api/admin/directory")
async def add_to_directory(hotel: Dict[str, str], user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
    """Admin tool to manually add a hotel to the shared directory."""
    name = hotel.get("name", "").title().strip()
    location = hotel.get("location", "").title().strip()
    serp_api_id = hotel.get("serp_api_id")
    
    if not name or not location:
        raise HTTPException(status_code=400, detail="Name and location are required")
        
    try:
        db.table("hotel_directory").upsert({
            "name": name,
            "location": location,
            "serp_api_id": serp_api_id,
            "last_verified_at": datetime.now().isoformat()
        }, on_conflict="name,location").execute()
        return {"status": "success", "hotel": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/users")
async def admin_list_users(user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
    """Admin: List all users and their subscription status."""
    # Start with a secure check (TODO: Add 'is_admin' check to get_current_user or similar)
    try:
        # Fetch profiles with hotel counts
        # Supabase doesn't support easy JOIN count in one API call usually, so we fetch profiles
        result = db.table("profiles").select("id, email, subscription_status, plan_type, current_period_end").execute()
        users = result.data
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/users/{user_id}/subscription")
async def admin_update_subscription(user_id: str, payload: Dict[str, Any], user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
    """Admin: Manually update user subscription."""
    valid_plans = ["trial", "starter", "pro", "enterprise"]
    valid_statuses = ["active", "trial", "past_due", "canceled"]
    
    plan_type = payload.get("plan_type")
    subscription_status = payload.get("subscription_status")
    
    update_data = {}
    if plan_type in valid_plans: update_data["plan_type"] = plan_type
    if subscription_status in valid_statuses: update_data["subscription_status"] = subscription_status
    
    # Optional extensions
    if payload.get("extend_trial_days"):
        days = int(payload.get("extend_trial_days"))
        new_end = datetime.now(timezone.utc) + timedelta(days=days)
        update_data["current_period_end"] = new_end.isoformat()

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields provided")

    try:
        db.table("profiles").update(update_data).eq("id", user_id).execute()
        return {"status": "success", "updated": update_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/sync")
async def sync_directory_manual(user: Any = Depends(get_current_admin_user), db: Optional[Client] = Depends(get_supabase)):
    """Backfill hotel_directory from existing hotels table."""
    # Seed list for "Cold Start" (Dev Mode / Empty DB)
    SEED_HOTELS = [
        {"name": "The Ritz London", "location": "London, UK", "serp_api_id": "5"},
        {"name": "Burj Al Arab", "location": "Dubai, UAE", "serp_api_id": "6"},
        {"name": "Plaza Hotel", "location": "New York, USA", "serp_api_id": "7"},
        {"name": "Marina Bay Sands", "location": "Singapore", "serp_api_id": "8"},
        {"name": "Hilton Paris Opera", "location": "Paris, France", "serp_api_id": "9"},
        {"name": "Waldorf Astoria", "location": "Amsterdam, Netherlands", "serp_api_id": "10"},
        {"name": "Raffles Istanbul", "location": "Istanbul, Turkey", "serp_api_id": "11"},
        {"name": "Atlantis The Palm", "location": "Dubai, UAE", "serp_api_id": "12"},
        {"name": "The Savoy", "location": "London, UK", "serp_api_id": "13"},
        {"name": "Bellagio", "location": "Las Vegas, USA", "serp_api_id": "14"},
    ]

    synced = 0
    total_scanned = 0
    
    try:
        if db:
            # 1. Try to sync from real user data
            result = db.table("hotels").select("name, location, serp_api_id").execute()
            hotels = result.data or []
            total_scanned = len(hotels)
            
            for h in hotels:
                try:
                    db.table("hotel_directory").upsert({
                        "name": h["name"],
                        "location": h.get("location"),
                        "serp_api_id": h.get("serp_api_id"),
                        "last_verified_at": datetime.now().isoformat()
                    }, on_conflict="name,location").execute()
                    synced += 1
                except:
                    continue
    except Exception as e:
        print(f"Sync error from real DB: {e}")

    # 2. If directory is still empty or few items, inject Seed Data
    if synced < 5 and db:
        for h in SEED_HOTELS:
            try:
                db.table("hotel_directory").upsert({
                    "name": h["name"],
                    "location": h["location"],
                    "serp_api_id": h["serp_api_id"],
                    "last_verified_at": datetime.now().isoformat()
                }, on_conflict="name,location").execute()
                synced += 1
            except:
                continue

    return {"status": "success", "synced_count": synced, "total_scanned": total_scanned}

@app.get("/api/sessions/{session_id}/logs", response_model=List[QueryLog])
async def get_session_logs(session_id: UUID, db: Client = Depends(get_supabase)):
    """Fetch all query logs linked to a specific scan session."""
    try:
        result = db.table("query_logs") \
            .select("*") \
            .eq("session_id", str(session_id)) \
            .order("created_at", desc=True) \
            .execute()
        return result.data or []
    except Exception as e:
        print(f"Error fetching session logs: {e}")
        return []

@app.get("/api/analysis/{user_id}")
async def get_analysis(
    user_id: UUID, 
    currency: Optional[str] = Query(None, description="Display currency (USD, EUR, GBP, TRY). Defaults to user settings."),
    start_date: Optional[str] = Query(None, description="Start date for analysis (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date for analysis (ISO format)"),
    exclude_hotel_ids: Optional[str] = Query(None, description="Comma-separated hotel IDs to exclude"),
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """Predictive market analysis with currency normalization, date filtering, and hotel exclusion."""
    from fastapi.encoders import jsonable_encoder
    from fastapi.responses import JSONResponse
    
    try:
        # 1. Fetch Currency Settings
        display_currency = currency
        if not display_currency:
            settings_result = db.table("settings").select("currency").eq("user_id", str(user_id)).execute()
            if settings_result.data and settings_result.data[0].get("currency"):
                display_currency = settings_result.data[0]["currency"]
            else:
                display_currency = "TRY"
        
        # 2. Fetch all hotels
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        hotels = hotels_result.data or []
        
        # 2b. Filter out excluded hotels
        excluded_ids = set()
        if exclude_hotel_ids:
            excluded_ids = set(exclude_hotel_ids.split(","))
        hotels = [h for h in hotels if str(h["id"]) not in excluded_ids]
        
        if not hotels:
            return JSONResponse(content={
                "market_average": 0, "market_min": 0, "market_max": 0,
                "target_price": None, "competitive_rank": 0,
                "display_currency": display_currency,
                "ari": 100.0, "sentiment_index": 100.0,
                "advisory_msg": "No hotel data available.",
                "quadrant_x": 0, "quadrant_y": 0, "quadrant_label": "Neutral",
                "price_rank_list": [], "daily_prices": [], "all_hotels": []
            })

        # 3. BATCH FETCH Price Logs for all hotels (with date filtering)
        hotel_ids = [str(h["id"]) for h in hotels]
        hotel_prices_map = {}
        all_daily_prices = []  # For calendar heatmap
        
        try:
            # Build query with date filters
            price_query = db.table("price_logs") \
                .select("*") \
                .in_("hotel_id", hotel_ids) \
                .order("recorded_at", desc=True)
            
            # Apply date filters if provided
            if start_date:
                price_query = price_query.gte("recorded_at", start_date)
            if end_date:
                price_query = price_query.lte("recorded_at", end_date + "T23:59:59")
            
            # Increase limit for calendar data
            all_prices_res = price_query.limit(500).execute()
            
            for p in (all_prices_res.data or []):
                hid = str(p["hotel_id"])
                if hid not in hotel_prices_map:
                    hotel_prices_map[hid] = []
                hotel_prices_map[hid].append(p)
                
        except Exception as e:
            print(f"Batch analysis price fetch failed: {e}")

        current_prices = []
        target_price = None
        target_hotel_id = None
        target_hotel_name = None
        target_sentiment = 0.0
        market_sentiments = []
        target_history = []
        
        # 4. Map Prices and Find Target
        for hotel in hotels:
            hid = str(hotel["id"])
            hotel_rating = hotel.get("rating") or 0.0
            market_sentiments.append(hotel_rating)
            
            # Explicit target check
            if hotel.get("is_target_hotel"):
                target_hotel_id = hid
                target_hotel_name = hotel.get("name")
                target_sentiment = hotel_rating

        # FALLBACK: If no explicit target, pick the first one
        # FALLBACK: If no explicit target, pick the first one
        if not target_hotel_id and hotels:
            target_hotel_id = str(hotels[0]["id"])
            target_hotel_name = hotels[0].get("name")
            target_sentiment = hotels[0].get("rating") or 0.0
            
        # Build price rank list for KPI hover (all hotels with prices)
        price_rank_list = []
        
        for hotel in hotels:
            hid = str(hotel["id"])
            is_target = (hid == target_hotel_id)
            
            prices = hotel_prices_map.get(hid, [])
            if prices:
                try:
                    orig_price = float(prices[0]["price"]) if prices[0].get("price") is not None else None
                    if orig_price is not None:
                        orig_currency = prices[0].get("currency") or "USD"
                        converted = convert_currency(orig_price, orig_currency, display_currency)
                        current_prices.append(converted)
                        
                        # Add to price rank list
                        price_rank_list.append({
                            "id": hid,
                            "name": hotel.get("name"),
                            "price": converted,
                            "rating": hotel.get("rating"),
                            "is_target": is_target
                        })
                        
                        if is_target:
                            target_price = converted
                            target_history = []
                            for p in prices[:30]:  # Last 30 entries for history
                                try:
                                    if p.get("price") is not None:
                                        target_history.append({
                                            "price": convert_currency(float(p["price"]), p.get("currency") or "USD", display_currency),
                                            "recorded_at": p.get("recorded_at")
                                        })
                                except Exception: continue
                except Exception as e:
                    print(f"Error processing price for hotel {hid}: {e}")

        # Sort price rank list by price (ascending = cheapest first)
        price_rank_list.sort(key=lambda x: x["price"])
        for i, item in enumerate(price_rank_list):
            item["rank"] = i + 1

        # 5. Build daily prices for calendar heatmap
        daily_prices = []
        if target_hotel_id:
            # Group all prices by date
            date_price_map = {}
            for hid, prices in hotel_prices_map.items():
                for p in prices:
                    try:
                        date_str = p.get("recorded_at", "")[:10]  # Extract YYYY-MM-DD
                        if date_str not in date_price_map:
                            date_price_map[date_str] = {"target": None, "competitors": []}
                        
                        price_val = float(p["price"]) if p.get("price") is not None else None
                        if price_val is not None:
                            converted_price = convert_currency(price_val, p.get("currency") or "USD", display_currency)
                            hotel_name = next((h["name"] for h in hotels if str(h["id"]) == hid), "Unknown")
                            
                            if hid == target_hotel_id:
                                date_price_map[date_str]["target"] = converted_price
                            else:
                                date_price_map[date_str]["competitors"].append({
                                    "name": hotel_name,
                                    "price": converted_price
                                })
                    except Exception:
                        continue
            
            # Calculate vs_comp for each date
            for date_str, data in sorted(date_price_map.items()):
                if data["target"] is not None and data["competitors"]:
                    # Deduplicate competitors by hotel name (keep first/latest price)
                    seen_hotels = set()
                    unique_competitors = []
                    for c in data["competitors"]:
                        if c["name"] not in seen_hotels:
                            seen_hotels.add(c["name"])
                            unique_competitors.append(c)
                    
                    if unique_competitors:
                        comp_avg = sum(c["price"] for c in unique_competitors) / len(unique_competitors)
                        vs_comp = ((data["target"] - comp_avg) / comp_avg) * 100 if comp_avg > 0 else 0
                        daily_prices.append({
                            "date": date_str,
                            "price": round(data["target"], 2),
                            "comp_avg": round(comp_avg, 2),
                            "vs_comp": round(vs_comp, 1),
                            "competitors": unique_competitors
                        })

        # 6. Calculate Stats
        market_avg = sum(current_prices) / len(current_prices) if current_prices else 0.0
        market_min = min(current_prices) if current_prices else 0.0
        market_max = max(current_prices) if current_prices else 0.0
        
        # Find min/max hotels for spread tooltip
        min_hotel = None
        max_hotel = None
        if price_rank_list:
            min_hotel = {"name": price_rank_list[0]["name"], "price": price_rank_list[0]["price"]}
            max_hotel = {"name": price_rank_list[-1]["name"], "price": price_rank_list[-1]["price"]}
        
        ari = (target_price / market_avg) * 100 if target_price and market_avg > 0 else 100.0
        
        avg_sentiment = sum(market_sentiments) / len(market_sentiments) if market_sentiments else 1.0
        sentiment_index = (target_sentiment / avg_sentiment) * 100 if target_sentiment and avg_sentiment > 0 else 100.0

        sorted_prices = sorted(current_prices)
        rank = sorted_prices.index(target_price) + 1 if target_price is not None and target_price in sorted_prices else 0
        
        # 7. Advisory & Quadrant
        advisory = "Overall market position is stable."
        if ari > 105:
            advisory = "Your rates are above market average. Ensure your high sentiment justifications are clear."
            if sentiment_index > 105:
                advisory = "Your premium pricing is well-supported by superior guest sentiment."
        elif ari < 95:
            advisory = "Your aggressive pricing is attracting volume. Monitor quality levels."
        elif sentiment_index < 90:
            advisory = "Your pricing is currently higher than supported by your guest sentiment."
            
        # 8. Extract Competitors (non-target hotels with prices)
        competitors_list = []
        for hotel in hotels:
            hid = str(hotel["id"])
            if hid != target_hotel_id:
                prices = hotel_prices_map.get(hid, [])
                if prices:
                    try:
                        orig_p = float(prices[0]["price"]) if prices[0].get("price") is not None else None
                        if orig_p is not None:
                            competitors_list.append({
                                "id": hid,
                                "name": hotel.get("name"),
                                "price": convert_currency(orig_p, prices[0].get("currency") or "USD", display_currency),
                                "rating": hotel.get("rating"),
                                "stars": hotel.get("stars")
                            })
                    except Exception: continue

        # 9. All hotels list (for filter UI)
        all_hotels_list = [{"id": str(h["id"]), "name": h.get("name"), "is_target": str(h["id"]) == target_hotel_id} for h in hotels]

        # 10. Final Response
        target_h = next((h for h in hotels if str(h["id"]) == target_hotel_id), None)
        analysis_data = {
            "hotel_id": target_hotel_id,
            "hotel_name": target_hotel_name,
            "market_average": round(market_avg, 2),
            "market_avg": round(market_avg, 2),  # alias for frontend
            "market_min": round(market_min, 2),
            "market_max": round(market_max, 2),
            "target_price": round(target_price, 2) if target_price else None,
            "competitive_rank": rank,
            "market_rank": rank,  # NEW: for Market Spread UI
            "total_hotels": len(hotels),
            "competitors": competitors_list,
            "price_history": target_history,
            "display_currency": display_currency,
            "ari": round(ari, 1),
            "sentiment_index": round(sentiment_index, 1),
            "advisory_msg": advisory,
            "quadrant_x": round(ari / 2, 1),
            "quadrant_y": round(sentiment_index / 2, 1),
            "quadrant_label": "Value Leader" if sentiment_index > 100 and ari < 100 else "Neutral",
            "target_rating": round(target_sentiment, 1),
            "market_rating": round(avg_sentiment, 1),
            # NEW fields for enhanced UI
            "price_rank_list": price_rank_list,
            "daily_prices": daily_prices,
            "all_hotels": all_hotels_list,
            "min_hotel": min_hotel,
            "max_hotel": max_hotel,
            "sentiment_breakdown": target_h.get("sentiment_breakdown") if target_h else None
        }
        
        return JSONResponse(content=jsonable_encoder(analysis_data))

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"CRITICAL ANALYSIS ERROR: {e}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"error": "Analysis Fail", "detail": str(e), "trace": tb[:500]}
        )

@app.get("/api/discovery/{hotel_id}")
async def get_discovery_rivals(
    hotel_id: str, 
    db: Client = Depends(get_supabase),
    current_active_user = Depends(get_current_active_user)
):
    """Fetch potential rivals using autonomous discovery engine."""
    from fastapi.encoders import jsonable_encoder
    from fastapi.responses import JSONResponse
    try:
        from backend.agents.analyst_agent import AnalystAgent
        analyst = AnalystAgent(db)
        rivals = await analyst.discover_rivals(hotel_id, limit=5)
        return JSONResponse(content=jsonable_encoder({"rivals": rivals}))
    except Exception as e:
        print(f"Discovery error: {e}")
        return JSONResponse(status_code=500, content={"error": "Discovery Fail", "detail": str(e)})

@app.get("/api/reports/{user_id}")
async def get_reports(user_id: UUID, db: Client = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """Fetch data for reporting and historical audit (Optimized)."""
    from fastapi.encoders import jsonable_encoder
    from fastapi.responses import JSONResponse
    try:
        # 1. Fetch real sessions
        sessions_result = db.table("scan_sessions") \
            .select("*") \
            .eq("user_id", str(user_id)) \
            .order("created_at", desc=True) \
            .limit(50) \
            .execute()
        
        sessions = sessions_result.data or []
        
        # 2. Fetch orphaned logs (Legacy scans without sessions)
        orphaned_result = db.table("query_logs") \
            .select("*") \
            .eq("user_id", str(user_id)) \
            .eq("action_type", "monitor") \
            .is_("session_id", "null") \
            .order("created_at", desc=True) \
            .limit(200) \
            .execute()
        
        orphaned_logs = orphaned_result.data or []
        
        # 3. Group orphaned logs into "Legacy Sessions" (within 5min window)
        legacy_sessions = []
        if orphaned_logs:
            current_group = []
            for log in orphaned_logs:
                try:
                    log_time = datetime.fromisoformat(log["created_at"].replace("Z", "+00:00"))
                    
                    if not current_group:
                        current_group.append(log)
                    else:
                        last_log = current_group[-1]
                        last_time = datetime.fromisoformat(last_log["created_at"].replace("Z", "+00:00"))
                        
                        if (last_time - log_time).total_seconds() < 300: # 5 min window
                            current_group.append(log)
                        else:
                            # synthesize session from group
                            legacy_sessions.append(synthesize_session(current_group))
                            current_group = [log]
                except Exception: continue
                legacy_sessions.append(synthesize_session(current_group))

        # Merge and sort
        all_sessions = sessions + legacy_sessions
        all_sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        # 4. Synthesize Weekly Summary
        summary = {
            "total_scans": len(all_sessions),
            "active_monitors": 1, # Placeholder
            "last_week_trend": "Increasing",
            "system_health": "100%"
        }

        return JSONResponse(content=jsonable_encoder({
            "sessions": all_sessions[:100],
            "weekly_summary": summary
        }))
    except Exception as e:
        print(f"Reports error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Reports Fail", "detail": str(e)})

def synthesize_session(logs: List[Dict]) -> Dict:
    """Creates a mock session object from a group of logs."""
    latest_log = logs[0]
    return {
        "id": latest_log["id"], # Proxy ID
        "user_id": latest_log["user_id"],
        "session_type": "legacy",
        "status": "completed",
        "hotels_count": len(logs),
        "created_at": latest_log["created_at"],
        "completed_at": latest_log["created_at"]
    }

from fastapi.responses import StreamingResponse
import csv
import io

@app.post("/api/reports/{user_id}/export")
async def export_report(user_id: UUID, format: str = "csv", db: Client = Depends(get_supabase)):
    """Export report data as CSV."""
    if format != "csv":
        return {"status": "error", "message": "Only CSV supported currently"}
        
    # Fetch report data (reuse logic: last 30 days of logs)
    # For MVP, we'll just dump the raw price_logs for this user's hotels
    
    # 1. Get user hotels
    hotels = db.table("hotels").select("id, name").eq("user_id", str(user_id)).execute().data or []
    if not hotels:
        return {"status": "error", "message": "No hotels found"}
        
    hotel_map = {h["id"]: h["name"] for h in hotels}
    hotel_ids = list(hotel_map.keys())
    
    # 2. Get logs
    logs = db.table("price_logs") \
        .select("*") \
        .in_("hotel_id", hotel_ids) \
        .order("recorded_at", desc=True) \
        .limit(1000) \
        .execute().data or []
        
    # 3. Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Hotel Name", "Price", "Currency", "Source"])
    
    for log in logs:
        writer.writerow([
            log["recorded_at"],
            hotel_map.get(log["hotel_id"], "Unknown"),
            log["price"],
            log.get("currency", "USD"),
            log.get("source", "SerpApi")
        ])
        
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{user_id}_{date.today()}.csv"}
    )


# ===== Admin Endpoints =====

@app.get("/api/admin/stats", response_model=AdminStats)
async def get_admin_stats(db: Client = Depends(get_supabase)):
    """Get system-wide statistics."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        # Count Users (approx via settings or profiles)
        users_count = db.table("settings").select("user_id", count="exact").execute().count or 0
        
        # Count Hotels
        hotels_count = db.table("hotels").select("id", count="exact").execute().count or 0
        
        # Count Scans
        scans_count = db.table("scan_sessions").select("id", count="exact").execute().count or 0
        
        # Count Directory
        directory_count = db.table("hotel_directory").select("id", count="exact").execute().count or 0
        
        # API Calls (Today) - approximation from scan sessions or logs
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
        # Build "Empty" stats with error indicator if needed, or raise HTTP error
        raise HTTPException(status_code=500, detail=f"Admin Data Error: {str(e)}")


@app.get("/api/admin/api-keys/status")
async def get_api_key_status(user: Any = Depends(get_current_admin_user)):
    """Get status of SerpApi keys for monitoring quota usage."""
    try:
        status = serpapi_client.get_key_status()
        # Add quota info
        status["quota_per_key"] = 250  # Monthly limit
        status["quota_period"] = "monthly"
        return status
    except Exception as e:
        print(f"API Key Status Error: {e}")
        return {
            "error": str(e),
            "total_keys": 0,
            "active_keys": 0
        }


@app.post("/api/admin/api-keys/rotate")
async def force_rotate_api_key(user: Any = Depends(get_current_admin_user)):
    """Force rotate to next API key (for testing or manual intervention)."""
    try:
        success = serpapi_client._key_manager.rotate_key("manual_rotation")
        return {
            "status": "success" if success else "failed",
            "message": "Rotated to next key" if success else "No available keys to rotate to",
            "current_status": serpapi_client.get_key_status()
        }
    except Exception as e:
        print(f"API Key Rotate Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/api-keys/reset")
async def reset_api_keys(user: Any = Depends(get_current_admin_user)):
    """Reset all API keys to active status (e.g., at new billing period)."""
    try:
        serpapi_client._key_manager.reset_all()
        return {
            "status": "success",
            "message": "All keys reset to active",
            "current_status": serpapi_client.get_key_status()
        }
    except Exception as e:
        print(f"API Key Reset Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/api-keys/reload")
async def reload_api_keys(user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
    """Force reload API keys from env."""
    try:
        # Check auth/admin permissions here if strict
        
        # Reload logic
        reload_result = serpapi_client.reload()
        
        # Fetch full status for UI
        full_status = serpapi_client.get_key_status()
        
        return {
            "message": f"Reloaded keys. Found {reload_result.get('total_keys', 0)}.",
            "total_keys": reload_result.get('total_keys', 0),
            "keys_found": [f"Key #{i+1}" for i in range(reload_result.get('total_keys', 0))],
            "env_debug": {
                "SERPAPI_API_KEY": "Set" if os.getenv("SERPAPI_API_KEY") else "Missing",
                "SERPAPI_API_KEY_2": "Set" if os.getenv("SERPAPI_API_KEY_2") else "Missing",
                "SERPAPI_KEY": "Set" if os.getenv("SERPAPI_KEY") else "Missing"
            },
            "current_status": full_status
        }
    except Exception as e:
        print(f"API Key Reload Error: {e}")
        # Return cleanly so frontend doesn't choke on 500 HTML
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to reload keys: {str(e)}",
                "error": str(e)
            }
        )


@app.get("/api/admin/users", response_model=List[AdminUser])
async def get_admin_users(db: Client = Depends(get_supabase)):
    """List all users with stats."""
    # Force Service Role for Admin Actions (Bypass RLS)
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database credentials missing. Admin access unavailable.")
    try:
        # Get base user info from profiles
        profiles = db.table("user_profiles").select("*").execute().data or []
        settings_data = db.table("settings").select("user_id, created_at, notification_email").execute().data or []
        sub_profiles = db.table("profiles").select("*").execute().data or []
        
        # Create map of sub profiles
        sub_map = {s["id"]: s for s in sub_profiles}
        
        # Merge data (naive join since no FK strictness in some mock data)
        users_map = {}
        for s in settings_data:
            users_map[s["user_id"]] = {
                "id": s["user_id"],
                "created_at": s["created_at"],
                "email": s.get("notification_email"),  # Use notification_email 
                "display_name": "Unknown",
                "company_name": None,
                "job_title": None,
                "phone": None,
                "timezone": None,
                "hotel_count": 0,
                "scan_count": 0,
                "plan_type": "trial",
                "subscription_status": "trial"
            }
            
        for p in profiles:
            uid = p["user_id"]
            if uid not in users_map:
                users_map[uid] = {
                    "id": uid,
                    "created_at": p["created_at"],
                    "email": None,
                    "display_name": p.get("display_name"),
                    "company_name": p.get("company_name"),
                    "job_title": p.get("job_title"),
                    "phone": p.get("phone"),
                    "timezone": p.get("timezone"),
                    "hotel_count": 0,
                    "scan_count": 0,
                    "plan_type": p.get("plan_type") or "trial",
                    "subscription_status": p.get("subscription_status") or "trial"
                }
            else:
                users_map[uid]["display_name"] = p.get("display_name")
                users_map[uid]["company_name"] = p.get("company_name")
                users_map[uid]["job_title"] = p.get("job_title")
                users_map[uid]["phone"] = p.get("phone")
                users_map[uid]["timezone"] = p.get("timezone")
                # Get subscription info from profiles table
                sub_data = sub_map.get(uid, {})
                
                users_map[uid]["plan_type"] = sub_data.get("plan_type") or p.get("plan_type") or "trial"
                users_map[uid]["subscription_status"] = sub_data.get("subscription_status") or p.get("subscription_status") or "trial"
                
        # Enrich with counts (this could be slow with many users, optimize later)
        final_users = []
        for uid, udata in users_map.items():
            try:
                # Count hotels
                h_count = db.table("hotels").select("id", count="exact").eq("user_id", uid).execute().count or 0
                s_count = db.table("scan_sessions").select("id", count="exact").eq("user_id", uid).execute().count or 0
                
                udata["hotel_count"] = h_count
                udata["scan_count"] = s_count
                final_users.append(AdminUser(**udata))
            except Exception as user_err:
                print(f"Error processing user {uid}: {user_err}")
                # Still include user with 0 counts
                final_users.append(AdminUser(**udata))
            
        return final_users
    except Exception as e:
        print(f"Admin Users Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


# ... create_admin_user ... skipped for snippet ...

@app.get("/api/admin/directory", response_model=List[AdminDirectoryEntry])
async def get_admin_directory(limit: int = 100, db: Client = Depends(get_supabase)):
    """List directory entries."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        result = db.table("hotel_directory").select("*").order("created_at", desc=True).limit(limit).execute()
        entries = []
        if result.data:
            for item in result.data:
                entries.append(AdminDirectoryEntry(
                    id=item["id"],
                    name=item["name"],
                    location=item["location"] or "Unknown",
                    serp_api_id=item.get("serp_api_id"),
                    created_at=item["created_at"]
                ))
        return entries
    except Exception as e:
        print(f"Admin Directory Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch directory: {str(e)}")

@app.post("/api/admin/users", response_model=dict)
async def create_admin_user(user: AdminUserCreate, db: Client = Depends(get_supabase)):
    """Create a new user manually."""
    # Use Service Role Key for Admin Actions
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not admin_key or not url:
        raise HTTPException(status_code=500, detail="Service Role Key missing")
    
    admin_db = create_client(url, admin_key)

    try:
        # Create user in Supabase Auth via Admin API
        # Using auto_confirm_email=True so they can login immediately
        res = admin_db.auth.admin.create_user({
            "email": user.email,
            "password": user.password,
            "email_confirm": True
        })
        
        new_user = res.user
        if not new_user:
            raise HTTPException(status_code=400, detail="Failed to create user")
            
        # Create profile entry
        admin_db.table("user_profiles").insert({
            "user_id": str(new_user.id),
            "display_name": user.display_name or user.email.split("@")[0],
            "email": user.email
        }).execute()
        
        return {
            "status": "success", 
            "user_id": str(new_user.id),
            "message": f"User {user.email} created successfully"
        }
    except Exception as e:
        print(f"Create User Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/admin/users/{user_id}")
async def delete_admin_user(user_id: UUID, db: Client = Depends(get_supabase)):
    """Delete a user and their data."""
    # Use Service Role Key for Admin Actions
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not admin_key or not url:
        raise HTTPException(status_code=500, detail="Service Role Key missing")
    
    admin_db = create_client(url, admin_key)

    # Helper to delete from tables
    for table in ["hotels", "scan_sessions", "user_profiles", "settings", "notifications"]:
        admin_db.table(table).delete().eq("user_id", str(user_id)).execute()
    
    # Delete from Auth
    try:
        admin_db.auth.admin.delete_user(str(user_id))
    except:
        pass # Ignore if auth user already gone
        
    return {"status": "success"}


@app.patch("/api/admin/users/{user_id}")
async def update_admin_user(user_id: UUID, update_data: Dict[str, Any], db: Client = Depends(get_supabase)):
    """Update user profile or subscription details."""
    
    # Use Service Role Key for Admin Actions
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not admin_key or not url:
        # Fallback to provided DB if env missing (dev mode), but likely fails RLS
        admin_db = db
    else:
        admin_db = create_client(url, admin_key)

    try:
        # 1. Separate profile vs subscription fields
        profile_fields = ["display_name", "company_name", "job_title", "phone", "timezone"]
        profile_update = {k: v for k, v in update_data.items() if k in profile_fields}
        
        # 2. Subscription fields (stored in user_profiles for this MVP, or separate table)
        # We need to check where `plan_type` and `subscription_status` are stored.
        # Based on get_admin_users, they are read from `user_profiles` logic or defaults.
        # Let's assume we added columns to user_profiles or we need to.
        # For now, let's try updating user_profiles.
        
        sub_fields = ["plan_type", "subscription_status"]
        sub_update = {}
        for f in sub_fields:
            if f in update_data:
                sub_update[f] = update_data[f]
                # CRITICAL FIX: Also update the user_profiles table so simple fetches work
                profile_update[f] = update_data[f]
                
        if sub_update:
            # Check if profile exists in 'profiles' table first
            try:
                exists = admin_db.table("profiles").select("id").eq("id", str(user_id)).execute().data
                if exists:
                    admin_db.table("profiles").update(sub_update).eq("id", str(user_id)).execute()
                else:
                    sub_update["id"] = str(user_id)
                    admin_db.table("profiles").insert(sub_update).execute()
            except Exception as e:
                print(f"Failed to update profiles table: {e}")
        
        if profile_update:
            admin_db.table("user_profiles").update(profile_update).eq("user_id", str(user_id)).execute()
            
        # 3. Handle Email Update (Auth)
        if "email" in update_data and update_data["email"]:
            admin_db.auth.admin.update_user_by_id(str(user_id), {"email": update_data["email"]})
            # Skip updating "user_profiles" email as the column doesn't exist there.
            
        # 4. Handle Password Update (Auth)
        if "password" in update_data and update_data["password"]:
             admin_db.auth.admin.update_user_by_id(str(user_id), {"password": update_data["password"]})

        # 5. Handle Extend Trial
        if "extend_trial_days" in update_data:
            # We might need a `trial_ends_at` column. 
            # For this MVP, let's assume we just set status to active/trial.
            pass 

        return {"status": "success", "message": "User updated"}
    except Exception as e:
        print(f"Update User Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/admin/directory", response_model=dict)
async def add_admin_directory_entry(entry: dict, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Add a directory entry manually."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        db.table("hotel_directory").insert({
            "name": entry["name"],
            "location": entry["location"],
            "serp_api_id": entry.get("serp_api_id")
        }).execute()
        return {"status": "success"}
    except Exception as e:
        print(f"Admin Add Directory Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/directory/{entry_id}")
async def delete_admin_directory(entry_id: str, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Delete a directory entry."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        db.table("hotel_directory").delete().eq("id", entry_id).execute()
        return {"status": "success"}
    except Exception as e:
        print(f"Admin Delete Directory Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/logs", response_model=List[AdminLog])
async def get_admin_logs(limit: int = 50, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Get system logs (from scan sessions for now)."""
    # Fetch recent sessions
    result = db.table("scan_sessions").select("*").order("created_at", desc=True).limit(limit).execute()
    logs = []
    if result.data:
        for session in result.data:
            # Determine level based on status
            level = "INFO"
            if session["status"] == "failed":
                level = "ERROR"
            elif session["status"] == "completed":
                level = "SUCCESS"
                
            logs.append(AdminLog(
                id=session["id"],
                timestamp=session["created_at"],
                level=level,
                action=f"Scan Session ({session['session_type']})",
                details=f"Checked {session.get('hotels_count', 0)} hotels",
                user_id=session["user_id"]
            ))
    return logs


# ===== Admin User Edit =====




@app.put("/api/admin/directory/{entry_id}")
async def update_admin_directory(entry_id: str, updates: dict, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Update a directory entry."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        update_data = {}
        if "name" in updates:
            update_data["name"] = updates["name"]
        if "location" in updates:
            update_data["location"] = updates["location"]
        if "serp_api_id" in updates:
            update_data["serp_api_id"] = updates["serp_api_id"]
        
        if update_data:
            db.table("hotel_directory").update(update_data).eq("id", entry_id).execute()
        
        return {"status": "success", "id": entry_id}
    except Exception as e:
        print(f"Admin Update Directory Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Admin Hotels CRUD =====

@app.get("/api/admin/hotels")
async def get_admin_hotels(limit: int = 100, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """List all hotels across all users with user info."""
    # Force Service Role for Admin Actions (Bypass RLS)
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
        
    try:
        # Join logic manual since we are using simple queries
        start = time.time()
        
        hotels = db.table("hotels").select("*").limit(limit).execute().data or []
        users = db.table("user_profiles").select("user_id, display_name, email").execute().data or []
        
        user_map = {u["user_id"]: u for u in users}
        
        results = []
        for h in hotels:
            try:
                user = user_map.get(h["user_id"], {})
                
                # Fetch last price
                last_price = None
                last_currency = "USD"
                last_scanned = None
                
                # Optimization: This N+1 query is bad but valid for MVP with low data
                try:
                    prices = db.table("price_logs").select("price, currency, recorded_at").eq("hotel_id", h["id"]).order("recorded_at", desc=True).limit(1).execute().data
                    if prices:
                        last_price = prices[0]["price"]
                        last_currency = prices[0]["currency"]
                        last_scanned = prices[0]["recorded_at"]
                except Exception:
                    pass # limit fetch errors

                results.append({
                    "id": h["id"],
                    "name": h["name"],
                    "location": h["location"],
                    "user_id": h["user_id"],
                    "user_display": user.get("display_name") or user.get("email"),
                    "serp_api_id": h.get("serp_api_id"),
                    "is_target_hotel": h["is_target_hotel"],
                    "preferred_currency": h.get("preferred_currency"),
                    "last_price": last_price,
                    "last_currency": last_currency,
                    "last_scanned": last_scanned,
                    "created_at": h["created_at"]
                })
            except Exception as e:
                print(f"Skipping invalid admin hotel row: {e}")
                continue
            
        return results
    except Exception as e:
        print(f"Admin Hotels Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    except Exception as e:
        print(f"Admin Hotels Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/scans")
async def get_admin_scans(limit: int = 50, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """List recent scan sessions with user info."""
    # Force Service Role for Admin Actions (Bypass RLS)
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
        
    try:
        # Fetch sessions
        sessions_result = db.table("scan_sessions") \
            .select("*") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        sessions = sessions_result.data or []
        
        # Fetch user info
        user_ids = list(set(s["user_id"] for s in sessions))
        users_map = {}
        
        if user_ids:
            # Fix: "email" column does not exist in user_profiles. Removed from select.
            profiles = db.table("user_profiles").select("user_id, display_name").in_("user_id", user_ids).execute()
            # Fallback to profiles logic if email is stored there or just use display_name
            for p in (profiles.data or []):
                users_map[p["user_id"]] = p.get("display_name") or "Unknown"
                
        # Enrich sessions
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
    except Exception as e:
        print(f"Admin Scans Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
        
# ===== Admin Global Settings =====

import time
import json


# Remove local file storage
# SETTINGS_FILE = "admin_settings.json"

def get_admin_settings_db(db_client: Client = None) -> AdminSettings:
    """Helper to fetch settings from DB."""
    if not db_client:
        db_client = get_supabase()
        if not db_client:
            # Fallback default
            return AdminSettings(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                maintenance_mode=False,
                signup_enabled=True,
                default_currency="USD",
                system_alert_message=None,
                updated_at=datetime.now(timezone.utc)
            )
            
    try:
        # Try to fetch singleton row
        # ID is fixed 0s from migration, or just take first
        res = db_client.table("admin_settings").select("*").limit(1).execute()
        if res.data:
            return AdminSettings(**res.data[0])
            
        # If empty (shouldn't happen due to migration), return default
        return AdminSettings(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            maintenance_mode=False,
            signup_enabled=True,
            default_currency="USD",
            system_alert_message=None,
            updated_at=datetime.now(timezone.utc)
        )
    except Exception as e:
        print(f"DB Settings Load Error: {e}")
        # Default fallback
        return AdminSettings(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            maintenance_mode=False,
            signup_enabled=True,
            default_currency="USD",
            system_alert_message=None,
            updated_at=datetime.now(timezone.utc)
        )

@app.get("/api/admin/settings", response_model=AdminSettings)
async def get_admin_settings(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Get global system settings."""
    return get_admin_settings_db(db)

@app.put("/api/admin/settings")
async def update_admin_settings(updates: AdminSettingsUpdate, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Update global system settings."""
    # Force Service Role for Admin Actions (Bypass RLS)
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    try:
        # Get current ID (usually the 0000... one)
        current = get_admin_settings_db(db)
        
        # Prepare updates
        update_data = updates.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update in DB
        # We assume the row exists per migration, but upsert is safer
        data_to_upsert = {
            "id": str(current.id),
            **current.model_dump(exclude={"id", "updated_at"}), # baseline
            **update_data
        }
        
        res = db.table("admin_settings").upsert(data_to_upsert).execute()
        
        if res.data:
            return AdminSettings(**res.data[0])
        else:
            # If no data returned, return estimated state
            return current.model_copy(update=update_data)
            
    except Exception as e:
        print(f"Settings Update Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")




@app.put("/api/admin/hotels/{hotel_id}")
async def update_admin_hotel(hotel_id: UUID, updates: dict, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Update a hotel's details."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        update_data = {}
        allowed_fields = ["name", "location", "serp_api_id", "is_target_hotel", "preferred_currency", "rating", "stars"]
        
        for field in allowed_fields:
            if field in updates:
                update_data[field] = updates[field]
        
        if update_data:
            update_data["updated_at"] = datetime.now().isoformat()
            db.table("hotels").update(update_data).eq("id", str(hotel_id)).execute()
        
        return {"status": "success", "hotel_id": str(hotel_id)}
    except Exception as e:
        print(f"Admin Update Hotel Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/hotels/{hotel_id}")
async def delete_admin_hotel(hotel_id: UUID, db: Client = Depends(get_supabase)):
    """Delete a hotel and its associated data."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        # Delete related data first
        db.table("price_logs").delete().eq("hotel_id", str(hotel_id)).execute()
        db.table("alerts").delete().eq("hotel_id", str(hotel_id)).execute()
        
        # Delete the hotel
        db.table("hotels").delete().eq("id", str(hotel_id)).execute()
        
        return {"status": "success"}
    except Exception as e:
        print(f"Admin Delete Hotel Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin Providers Endpoint
@app.get("/api/admin/providers")
async def get_admin_providers(current_admin = Depends(get_current_admin_user)):
    """Fetch status of all data providers."""
    try:
        return ProviderFactory.get_status_report()
    except Exception as e:
        print(f"Provider Report Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin Scan Details
@app.get("/api/admin/scans/{session_id}")
async def get_admin_scan_details(session_id: UUID, db: Client = Depends(get_supabase)):
    """Get full details for a specific scan session including logs."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
        
    try:
        # Fetch session
        session_res = db.table("scan_sessions").select("*").eq("id", str(session_id)).single().execute()
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Session not found")
            
        session = session_res.data
        
        # Fetch logs
        logs_res = db.table("query_logs").select("*").eq("session_id", str(session_id)).order("created_at", desc=True).execute()
        
        return {
            "session": session,
            "logs": logs_res.data or []
        }
    except Exception as e:
        print(f"Admin Scan Details Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin Plans CRUD
@app.get("/api/admin/plans")
async def get_admin_plans(db: Optional[Client] = Depends(get_supabase)):
    if not db: return []
    try:
        res = db.table("membership_plans").select("*").order("price_monthly", desc=False).execute()
        return res.data or []
    except Exception as e:
        print(f"Error getting plans: {e}")
        return []

@app.post("/api/admin/plans")
async def create_admin_plan(plan: PlanCreate, db: Optional[Client] = Depends(get_supabase)):
    if not db: raise HTTPException(503, "DB unavailable")
    try:
        data = plan.model_dump()
        res = db.table("membership_plans").insert(data).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(400, f"Failed to create plan: {str(e)}")

@app.put("/api/admin/plans/{plan_id}")
async def update_admin_plan(plan_id: UUID, plan: PlanUpdate, db: Optional[Client] = Depends(get_supabase)):
    if not db: raise HTTPException(503, "DB unavailable")
    try:
        data = {k: v for k, v in plan.model_dump().items() if v is not None}
        if not data: return {"status": "no_change"}
        res = db.table("membership_plans").update(data).eq("id", str(plan_id)).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(400, f"Failed to update plan: {str(e)}")

@app.delete("/api/admin/plans/{plan_id}")
async def delete_admin_plan(plan_id: UUID, db: Optional[Client] = Depends(get_supabase)):
    if not db: raise HTTPException(503, "DB unavailable")
    try:
        db.table("membership_plans").delete().eq("id", str(plan_id)).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(400, f"Failed to delete plan: {str(e)}")
