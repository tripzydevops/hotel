"""
Hotel Rate Monitor - FastAPI Backend
Main application with monitoring and API endpoints.
"""

import os
import sys

# Ensure backend module is resolvable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone, timedelta
from uuid import UUID
from pydantic import BaseModel, Field
from dotenv import load_dotenv
# Load environment variables from .env and .env.local (Vercel style)
load_dotenv()
load_dotenv(".env.local", override=True)
from supabase import create_client, Client
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.encoders import jsonable_encoder
# from weasyprint import HTML # Moved to local import

from backend.models.schemas import (
    Hotel, HotelCreate, HotelUpdate,
    Settings, SettingsUpdate,
    Alert, MonitorResult,
    QueryLog, ScanOptions,
    UserProfile, UserProfileUpdate,
    PlanCreate, PlanUpdate, LocationRegistry,
    # Admin Models
    AdminStats, AdminUserCreate, AdminUser, AdminUserUpdate, AdminDirectoryEntry, 
    AdminLog, AdminSettings, AdminSettingsUpdate, SchedulerQueueEntry
)
# Fix: explicit imports to avoid module/instance shadowing
from backend.services.serpapi_client import serpapi_client
from backend.services.price_comparator import price_comparator
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

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    error_header = f"CRITICAL 500: {str(exc)}"
    print(error_header)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": error_header, "trace": traceback.format_exc()},
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

@app.get("/api/debug-status")
async def debug_status():
    return {
        "status": "ok", 
        "env": {
            "SUPABASE_URL": bool(os.getenv("NEXT_PUBLIC_SUPABASE_URL")),
            "SUPABASE_KEY": bool(os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
        }
    }

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
        if email and (email in ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com"] or email.endswith("@hotel.plus")):
            print(f"Admin Auth: {email} allowed via Whitelist")
            return user_obj
        
        # 1.5 DB Client Check
        if not db:
             print("Admin Auth: DB Client is None")
             raise HTTPException(status_code=503, detail="Database Service Unavailable")

        # 2. Check Database Role
        # Use limit(1) instead of single() to avoid crash if no profile
        try:
            profile = db.table("user_profiles").select("role").eq("user_id", user_id).limit(1).execute()
            
            if profile.data and profile.data[0].get("role") in ["admin", "market_admin", "market admin"]:
                print(f"Admin Auth: {email} allowed via DB Role ({profile.data[0].get('role')})")
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
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Auth Check CRITICAL: {e}")
        # Print stack trace for Vercel logs
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Authentication System Failure: {str(e)}")


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
        "version": "1.0.7-bypass-fix"
    }


# ===== Dashboard Endpoint =====

@app.get("/api/v1/discovery/{hotel_id}")
async def discover_competitors(hotel_id: str, limit: int = 5, current_user = Depends(get_current_active_user), db: Client = Depends(get_supabase)):
    """
    Endpoint for Autonomous Rival Discovery.
    Uses AnalystAgent to perform vector similarity search.
    """
    try:
        # Ensure db is available
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Import AnalystAgent here to avoid circular dependencies or unnecessary imports
        # if it's only used in this specific endpoint.
        from backend.agents.analyst_agent import AnalystAgent 
        
        agent = AnalystAgent(db)
        rivals = await agent.discover_rivals(hotel_id, limit=limit)
        return rivals
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in /api/v1/discovery/{hotel_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

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

    # Security: Check if user is accessing their own data OR is an admin
    if str(current_user.id) != str(user_id):
        # Check if admin
        is_admin = False
        try:
            # Re-use admin check logic (simplified here)
            email = current_user.email
            if email and (email in ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com"] or email.endswith("@hotel.plus")):
                is_admin = True
            elif db:
                # DB check
                profile = db.table("user_profiles").select("role").eq("user_id", current_user.id).limit(1).execute()
                if profile.data and profile.data[0].get("role") in ["admin", "market_admin", "market admin"]:
                    is_admin = True
        except Exception as e:
            print(f"Impersonation Auth Check Failed: {e}")
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Unauthorized access to this dashboard")

    try:
        if not db:
            return JSONResponse(content=fallback_data)

        # 1. Fetch hotels
        try:
            hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
            all_hotels = hotels_result.data or []
            # Filter out hotels without a property_token or serp_api_id (unusable for scans)
            hotels = [h for h in all_hotels if h.get("property_token") or h.get("serp_api_id")]
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
                            # Use getattr to safely get .value if it's an Enum, or fallback to str
                            trend_val = str(getattr(t, "value", t))
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
                            "offers": current_price.get("parity_offers") or current_price.get("offers") or [],
                            "room_types": current_price.get("room_types") or [],
                            "search_rank": current_price.get("search_rank")
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

        # 4. Next Scan calculation
        next_scan_at = None
        try:
            settings_res = db.table("settings").select("check_frequency_minutes").eq("user_id", str(user_id)).execute()
            if settings_res.data:
                freq = settings_res.data[0].get("check_frequency_minutes", 0)
                if freq > 0 and hotel_ids:
                    # Use last_log definition from earlier check if possible, or fetch
                    last_log_res = db.table("price_logs") \
                        .select("recorded_at") \
                        .in_("hotel_id", hotel_ids) \
                        .order("recorded_at", desc=True) \
                        .limit(1) \
                        .execute()
                    
                    if last_log_res.data:
                        last_run_iso = last_log_res.data[0]["recorded_at"]
                        last_run = datetime.fromisoformat(last_run_iso.replace("Z", "+00:00"))
                        next_scan_at = (last_run + timedelta(minutes=freq)).isoformat()
        except Exception as e:
            print(f"NextScanCalc Error: {e}")

        # 5. Final Serialized Response
        final_response = {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "recent_searches": recent_searches,
            "scan_history": scan_history,
            "recent_sessions": recent_sessions,
            "unread_alerts_count": unread_count,
            "next_scan_at": next_scan_at,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "scheduled_status": "Calculating next scan based on last manual or scheduled update."
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
        if email and (email in ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com"] or email.endswith("@hotel.plus")):
            is_admin = True
        
        # 2. DB Role Check (if not already whitelisted)
        if not is_admin:
            try:
                profile_res = db.table("user_profiles").select("role").eq("user_id", str(current_user.id)).execute()
                if profile_res.data and profile_res.data[0].get("role") in ["admin", "market_admin", "market admin"]:
                    is_admin = True
            except Exception:
                pass

        # 3. Specific Bypass for User ID: eb284dd9-7198-47be-acd0-fdb0403bcd0a
        specific_admin_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
        if str(user_id) == specific_admin_id:
            is_admin = True
            print(f"[Monitor] Specific ID Bypass for {user_id}")

        if is_admin:
            print(f"[Monitor] Admin Bypass ACTIVE for {email or user_id}")
        else:
            # ENFORCE LIMITS (Standard/Enterprise Users)
            # 1. Get User Plan Limits from tier_configs
            daily_manual_limit = 0
            monthly_total_limit = 500  # Default
            plan_type = "starter"
            
            profiles_res = db.table("profiles").select("plan_type").eq("id", str(user_id)).execute()
            if profiles_res.data:
                plan_type = profiles_res.data[0].get("plan_type", "starter")
                
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
    if not check_in:
        check_in = today
        
    if not check_out:
        check_out = check_in + timedelta(days=1)
    elif isinstance(check_out, date) and isinstance(check_in, date) and check_out <= check_in:
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
        print("[Orchestrator] Triggering AnalystAgent for analysis...")
        analysis = await analyst.analyze_results(user_id, scraper_results, threshold, options=options, session_id=session_id)

        # 4.5 Phase 2.5: Room Type Catalog (Embedding new room types)
        # Automatically embeds newly discovered room types for cross-hotel matching.
        # Only processes NEW room types — skips already-cataloged ones to minimize API calls.
        try:
            from backend.services.room_type_service import update_room_type_catalog
            print("[Orchestrator] Triggering RoomTypeCatalog update...")
            await update_room_type_catalog(db, scraper_results, hotels)
        except Exception as e:
            # Non-critical — don't fail the scan if embedding fails
            print(f"[Orchestrator] RoomTypeCatalog update failed (non-critical): {e}")

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
        
    # =======================================================
    # Determine Limit based on Plan
    # Default: 3 hotels (Trial users)
    # Enterprise/Pro: 5 hotels (1 target + 4 competitors)
    # Dev User: 10 hotels (for testing)
    # =======================================================
    limit = 1 # Default / Trial
    
    # Check Admin Status first for Bypass
    is_admin = False
    email = getattr(current_user, 'email', None)
    if email and (email in ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com"] or email.endswith("@hotel.plus")):
        is_admin = True
    else:
        try:
            profile_res = db.table("user_profiles").select("role").eq("user_id", str(user_id)).execute()
            if profile_res.data and profile_res.data[0].get("role") in ["admin", "market_admin", "market admin"]:
                is_admin = True
        except: pass

    # 3. Specific Bypass for User ID: eb284dd9-7198-47be-acd0-fdb0403bcd0a
    specific_admin_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    if str(user_id) == specific_admin_id:
        is_admin = True
        print(f"[CreateHotel] Specific ID Bypass for {user_id}")

    # 1. Admin/Dev Override
    if is_admin or str(user_id) == "123e4567-e89b-12d3-a456-426614174000":
        limit = 999
    else:
        # 2. Check Plan from BOTH tables to ensure we find it
        plan = "trial"
        try:
            # Primary: Check profiles table (source of truth for subscription)
            profiles_res = db.table("profiles").select("plan_type").eq("id", str(user_id)).execute()
            if profiles_res.data and profiles_res.data[0].get("plan_type"):
                plan = profiles_res.data[0].get("plan_type")
            else:
                # Fallback: Check user_profiles table
                user_profiles_res = db.table("user_profiles").select("plan_type").eq("user_id", str(user_id)).execute()
                if user_profiles_res.data:
                    plan = user_profiles_res.data[0].get("plan_type", "trial")
            
            # Map plan to limit (Sync with constants.ts)
            PLAN_LIMITS = {
                "trial": 1,
                "starter": 5,
                "pro": 25,
                "professional": 25,
                "enterprise": 999
            }
            limit = PLAN_LIMITS.get(plan, 1)
        except Exception as e:
            print(f"Plan check failed: {e}")

    # Check hotel limit - STRICT ENFORCEMENT
    existing = db.table("hotels").select("id").eq("user_id", str(user_id)).execute()
    if existing.data and len(existing.data) >= limit:
        raise HTTPException(status_code=403, detail=f"Hotel limit reached (Max {limit}). Please upgrade to Enterprise for more.")
        
    
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
            "threshold_percent": settings.threshold_percent or 2.0,
            "check_frequency_minutes": settings.check_frequency_minutes if settings.check_frequency_minutes is not None else 144,
            "notifications_enabled": settings.notifications_enabled if settings.notifications_enabled is not None else True,
            "push_enabled": settings.push_enabled if settings.push_enabled is not None else False,
            "currency": settings.currency or "USD",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
    # Check if settings exist
    existing = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
    
    update_data = settings.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if not existing.data:
        # Insert
        result = db.table("settings").insert({
            "user_id": str(user_id),
            **update_data
        }).execute()
    else:
        # Update
        result = db.table("settings").update(update_data).eq("user_id", str(user_id)).execute()
        
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update settings")
        
    return result.data[0]


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
    bypass_active = False
    
    if sub_data:
        plan = sub_data[0].get("plan_type") or "trial"
        status = sub_data[0].get("subscription_status") or "trial"
    
    # Force Enterprise for Admins/Whitelisted emails
    admin_email_found = None
    try:
        # USER ID from console: eb284dd9-7198-47be-acd0-fdb0403bcd0a
        specific_admin_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
        is_specific_admin = str(user_id) == specific_admin_id
        
        if admin_key and url:
            admin_db = create_client(url, admin_key)
            try:
                user_auth = admin_db.auth.admin.get_user_by_id(str(user_id))
                if user_auth and user_auth.user:
                    admin_email_found = user_auth.user.email
            except Exception as auth_err:
                print(f"[Profile] Auth Lookup Error for {user_id}: {auth_err}")
            
            is_admin_email = admin_email_found and (admin_email_found in ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com", "yusuf@tripzy.travel"] or admin_email_found.endswith("@hotel.plus"))
            
            # Check DB Role as well
            is_admin_role = False
            if result.data and result.data[0].get("role") in ["admin", "market_admin", "market admin"]:
                is_admin_role = True
                
            if is_admin_email or is_admin_role or is_specific_admin:
                plan = "enterprise"
                status = "active"
                bypass_active = True
                print(f"[Profile] Admin Bypass OK: {admin_email_found or user_id} (Role: {is_admin_role}, ID Match: {is_specific_admin})")
            else:
                print(f"[Profile] No Bypass: {admin_email_found or user_id} (Not an admin)")
        else:
            # Emergency bypass even if keys missing
            if is_specific_admin:
                plan = "enterprise"
                status = "active"
                bypass_active = True
                print(f"[Profile] Emergency ID Bypass for {user_id}")
            else:
                print(f"[Profile] Warning: SUPABASE_SERVICE_ROLE_KEY or URL missing")
    except Exception as e:
        print(f"[Profile] Admin Bypass Logic Error: {e}")

    # FORCE Enterprise for this specific User ID regardless of above
    if str(user_id) == "eb284dd9-7198-47be-acd0-fdb0403bcd0a":
        plan = "enterprise"
        status = "active"
        bypass_active = True

    # 3. Fallback logic: Use user_profiles data if profiles sync failed
    if (not sub_data or plan == "trial") and result.data:
        # Check if the base profile has the data (from migration backfill or double-write)
        base_plan = result.data[0].get("plan_type")
        base_status = result.data[0].get("subscription_status")
        # Only fallback if bypass didn't already set it higher
        if not bypass_active:
            if base_plan: plan = base_plan
            if base_status: status = base_status
            print(f"[Profile] Using Fallback Plan: {plan}")

    # Force PRO for Dev/Demo User (Legacy check)
    if is_dev_user:
        plan = "enterprise"
        status = "active"
        bypass_active = True

    if result.data:
        p = result.data[0]
        p["plan_type"] = plan
        p["subscription_status"] = status
        p["is_admin_bypass"] = bypass_active
        return p
    
    # Final Fallback return
    return UserProfile(
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        plan_type=plan,
        subscription_status=status,
        is_admin_bypass=bypass_active
    )
    
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



# Legacy/Deprecated Cron logic removed.
# See new implementation of /api/cron at the end of file.



@app.api_route("/api/trigger-scan/{user_id}", methods=["GET", "POST", "OPTIONS"])
async def check_scheduled_scan(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    force: bool = Query(False),
    db: Optional[Client] = Depends(get_supabase)
):
    """
    Lazy cron workaround for Vercel free tier.
    Called on dashboard load or manually by admin (force=true).
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
        
        # If not forcing, check frequency
        if not force and freq_minutes <= 0:
            return {"triggered": False, "reason": "MANUAL_ONLY"}
        
        # Get user's hotels
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        hotels = hotels_result.data or []
        
        if not hotels:
            return {"triggered": False, "reason": "NO_HOTELS"}
        
        hotel_ids = [h["id"] for h in hotels]
        
        # [Fix: Scan Spam] Check if a scan is ALREADY pending or running in the last 60 mins
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
                 if not force:
                    return {"triggered": False, "reason": "ALREADY_PENDING"}
        
        should_run = force
        if not should_run:
            # Check last scan time
            last_log = db.table("price_logs") \
                .select("recorded_at") \
                .in_("hotel_id", hotel_ids) \
                .order("recorded_at", desc=True) \
                .limit(1) \
                .execute()
                
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
                    "session_type": "scheduled" if not force else "manual_admin",
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

@app.post("/api/analysis/discovery/{hotel_id}")
async def discover_competitors(
    hotel_id: UUID,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    Triggers Autonomous Discovery to find Ghost Competitors (rivals in directory not yet tracked).
    Uses Vector Similarity Search (pgvector).
    """
    try:
        analyst = AnalystAgent(db)
        
        # 1. Get the hotel record to get its SerpApi ID
        hotel = db.table("hotels").select("*").eq("id", str(hotel_id)).single().execute()
        if not hotel.data:
            raise HTTPException(status_code=404, detail="Hotel not found")
            
        serp_api_id = hotel.data.get("serp_api_id")
        if not serp_api_id:
            # If no SerpApi ID, we try to discover by name/location context
            print(f"[Discovery] Warning: No SerpApi ID for {hotel_id}. Falling back to name-based context.")
            serp_api_id = str(hotel_id)

        # 2. Run Autonomous Discovery
        discoveries = await analyst.discover_rivals(serp_api_id)
        
        return {
            "status": "success",
            "matches": discoveries,
            "count": len(discoveries)
        }
    except Exception as e:
        print(f"[Discovery] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



def _transform_serp_links(breakdown):
    """
    Transforms raw SerpApi JSON links into user-friendly Google Travel URLs.
    Extracts 'property_token' to construct: https://www.google.com/travel/hotels/entity/{token}/reviews
    """
    if not breakdown or not isinstance(breakdown, list):
        return breakdown
    
    import re
    
    transformed = []
    for item in breakdown:
        # Safety check for dict items
        if not isinstance(item, dict):
            transformed.append(item)
            continue
            
        new_item = item.copy()
        link = new_item.get("serpapi_link")
        
        # Check if it's a SerpApi link that needs fixing
        if link and "serpapi.com" in link:
            try:
                # Decode URL first to handle encoded characters
                from urllib.parse import unquote
                decoded_link = unquote(link)
                
                # Extract property_token (e.g. CgoI...) - catch anywhere
                token_match = re.search(r"property_token=([^&]+)", decoded_link)
                
                if token_match:
                    token = token_match.group(1)
                    # Construct Google Travel URL
                    new_item["serpapi_link"] = f"https://www.google.com/travel/hotels/entity/{token}/reviews"
            except Exception:
                pass # Fail silently and keep original link
            
        transformed.append(new_item)
        
    return transformed


@app.get("/api/analysis/{user_id}")
async def get_analysis(
    user_id: UUID, 
    currency: Optional[str] = Query(None, description="Display currency (USD, EUR, GBP, TRY). Defaults to user settings."),
    start_date: Optional[str] = Query(None, description="Start date for analysis (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date for analysis (ISO format)"),
    exclude_hotel_ids: Optional[str] = Query(None, description="Comma-separated hotel IDs to exclude"),
    room_type: Optional[str] = Query(None, description="Filter by specific room type (e.g. 'Deluxe Suite')"),
    search_query: Optional[str] = Query(None, description="Semantic search query to filter hotels"),
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """Predictive market analysis with currency normalization, date filtering, and hotel exclusion."""
    from fastapi.encoders import jsonable_encoder
    from fastapi.responses import JSONResponse
    from backend.utils.embeddings import get_embedding
    
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
        
        # 2b. Semantic Search Filter
        if search_query:
            try:
                # Generate embedding for the query
                query_embedding = await get_embedding(search_query)
                if query_embedding:
                    # Find semantic matches in the user's hotel set
                    # We utilize the existing 'match_hotels' RPC but filter by user_id implicitly by intersection
                    # Or we can just compute cosine similarity in python if list is small, 
                    # but RPC is better if 'embedding' column exists.
                    # Assuming 'hotels' table has 'sentiment_embedding' or 'embedding'.
                    # AnalystAgent updates 'sentiment_embedding'.
                    
                    matches = db.rpc("match_hotels", {
                        "query_embedding": query_embedding,
                        "match_threshold": 0.6, # Lower threshold for broad matching
                        "match_count": 50
                    }).execute()
                    
                    if matches.data:
                        matched_ids = set([str(m["id"]) for m in matches.data])
                        # Filter hotels list to only include matches
                        hotels = [h for h in hotels if str(h["id"]) in matched_ids]
            except Exception as e:
                print(f"Semantic search failed: {e}")

        # 2c. Filter out excluded hotels
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
            
            # Apply date filters if provided (Filter primarily by check-in date for Calendar view)
            if start_date:
                # Use check_in_date for future availability/pricing analysis
                price_query = price_query.gte("check_in_date", start_date)
            else:
                # Default to today if no date provided, to show upcoming rates
                from datetime import datetime
                today = datetime.now().strftime("%Y-%m-%d")
                price_query = price_query.gte("check_in_date", today)
                start_date = today # Ensure we have a start date for gap filling
                
            if end_date:
                price_query = price_query.lte("check_in_date", end_date)

            # Increase limit for calendar data (fetching enough future dates)
            # Order by recorded_at desc ensures we get the LATEST scan for each check-in date
            all_prices_res = price_query.limit(5000).execute()
            
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
        market_sentiments: List[float] = []
        target_history = []

        # -------------------------------------------------------------
        # Phase 1: Semantic Room Matching
        # If a room_type is requested, use vector search to find 
        # the equivalent room names for EACH hotel (e.g. "Standard" -> "Standart Oda")
        # -------------------------------------------------------------
        allowed_room_names_map: Dict[str, set] = {} # hotel_id -> set(allowed_names)
        
        if room_type:
            try:
                # 1. Get embedding for the requested room type name (seed)
                # We look in the catalog for ANY hotel that has this room name to get a "seed" embedding.
                catalog_res = db.table("room_type_catalog") \
                    .select("embedding") \
                    .eq("original_name", room_type) \
                    .limit(1) \
                    .execute()
                
                if catalog_res.data:
                    embedding = catalog_res.data[0]["embedding"]
                    
                    # 2. Find matches across ALL hotels using the seed embedding
                    # RPC returns: hotel_id, original_name, similarity
                    matches_res = db.rpc("match_room_types", {
                        "query_embedding": embedding,
                        "match_threshold": 0.82,  # 82% similarity threshold
                        "match_count": 100 
                    }).execute()
                    
                    for match in (matches_res.data or []):
                        hid = str(match["hotel_id"])
                        if hid not in allowed_room_names_map:
                            allowed_room_names_map[hid] = set()
                        allowed_room_names_map[hid].add(match["original_name"])
                    
                    # Ensure the EXACT requested name is always allowed for all hotels (fallback)
                    for h in hotels:
                        hid = str(h["id"])
                        if hid not in allowed_room_names_map:
                            allowed_room_names_map[hid] = set()
                        allowed_room_names_map[hid].add(room_type)
                        
                else:
                     # No embedding found (e.g. custom name). Fallback to exact string match everywhere.
                     pass 

            except Exception as e:
                print(f"Semantic room matching failed: {e}")
                # Fallback: allowed_room_names_map stays empty, use string matching
        
        # -------------------------------------------------------------
        # Helper to extract price for specific room type (Semantic + Exact)
        # -------------------------------------------------------------
        def get_price_for_room(price_log, target_room_type):
            # If no filter, return the lead price (cheapest)
            if not target_room_type:
                return float(price_log["price"]) if price_log.get("price") is not None else None, "Lead Price", 1.0
            
            # Check room_types array
            r_types = price_log.get("room_types") or []
            if isinstance(r_types, list):
                # 1. Check for Semantic Match first (if map exists)
                hid = str(price_log.get("hotel_id", ""))
                allowed_names = allowed_room_names_map.get(hid)
                
                if allowed_names:
                    # Semantic Mode: Only accept room names in the allowed set
                    for r in r_types:
                        if isinstance(r, dict) and r.get("name") in allowed_names:
                             # For now we assume high confidence if it was in the allowed map (which used 0.82 threshold)
                             return _extract_price(r.get("price")), r.get("name"), 0.82 + (0.1 * int(r.get("name") == target_room_type))
                
                # 2. Fallback: String Match (Substring)
                # Used if semantic lookup failed or room type not in catalog
                for r in r_types:
                    if isinstance(r, dict) and (target_room_type.lower() in (r.get("name") or "").lower()):
                        return _extract_price(r.get("price")), r.get("name"), 0.9 if r.get("name") == target_room_type else 0.75
                        
            return None, None, 0.0

        def _extract_price(raw):
            if raw is not None:
                try:
                    if isinstance(raw, str):
                        import re
                        clean = re.sub(r'[^\d.]', '', raw)
                        return float(clean)
                    return float(raw)
                except: pass
            return None

        # Collect all available rooms 
        available_room_types = set()
        for hid, prices in hotel_prices_map.items():
            for p in prices:
                rt = p.get("room_types")
                if isinstance(rt, list):
                    for r in rt:
                        if isinstance(r, dict) and r.get("name"):
                            available_room_types.add(r["name"])

        # 4. Map Prices and Find Target
        for hotel in hotels:
            hid = str(hotel["id"])
            hotel_rating = float(hotel.get("rating") or 0.0)
            reviews = int(hotel.get("review_count") or 0)
            
            import math
            weight = math.log10(reviews + 10) / 2.0 
            weighted_sentiment = hotel_rating * weight
            
            market_sentiments.append(weighted_sentiment)
            
            if hotel.get("is_target_hotel"):
                target_hotel_id = hid
                target_hotel_name = hotel.get("name")
                target_sentiment = weighted_sentiment

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
                    # Resolve price based on room_type filter
                    # Use lead price currency as fallback
                    lead_currency = prices[0].get("currency") or "USD"
                    
                    
                    orig_price, matched_room, match_score = get_price_for_room(prices[0], room_type)
                    
                    if orig_price is not None:
                        converted = convert_currency(orig_price, lead_currency, display_currency)
                        current_prices.append(converted)
                        
                        # Add to price rank list
                        price_rank_list.append({
                            "id": hid,
                            "name": hotel.get("name"),
                            "price": converted,
                            "rating": hotel.get("rating"),
                            "is_target": is_target,
                            "offers": prices[0].get("parity_offers") or prices[0].get("offers") or [],
                            "room_types": prices[0].get("room_types") or [],
                            "matched_room_name": matched_room,
                            "match_score": match_score
                        })
                        
                        if is_target:
                            target_price = converted
                            # Ensure prices is a list before slicing to satisfy linter
                            p_list: List[Dict[str, Any]] = list(prices) if isinstance(prices, list) else []
                            for p in p_list[:30]:  # type: ignore
                                try:
                                    hist_price, _, _ = get_price_for_room(p, room_type)
                                    if hist_price is not None:
                                        target_history.append({
                                            "price": convert_currency(hist_price, p.get("currency") or "USD", display_currency),
                                            "recorded_at": p.get("recorded_at")
                                        })
                                except (Exception, TypeError): continue
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
            date_price_map: Dict[str, Dict[str, Any]] = {}
            for hid, prices in hotel_prices_map.items():
                for p in prices:
                    try:
                        # Normalize date to YYYY-MM-DD to match loop keys
                        raw_date = str(p.get("check_in_date", ""))
                        date_str = raw_date.split('T')[0]
                        
                        if date_str not in date_price_map:
                            date_price_map[date_str] = {"target": None, "competitors": []}
                        
                        price_val = float(p["price"]) if p.get("price") is not None else None
                        if price_val is not None:
                            converted_price = convert_currency(price_val, p.get("currency") or "USD", display_currency)
                            hotel_name = next((h["name"] for h in hotels if str(h["id"]) == hid), "Unknown")
                            
                            if hid == target_hotel_id:
                                date_price_map[date_str]["target"] = converted_price # type: ignore
                            else:
                                date_price_map[date_str]["competitors"].append({ # type: ignore
                                    "name": hotel_name,
                                    "price": converted_price
                                })
                    except Exception:
                        continue
            
            # Calculate vs_comp for each date
            # Calculate vs_comp for each date and Fill Gaps
            from datetime import datetime, timedelta
            
            # Determine date range
            # Determine date range
            range_start = None
            range_end = None
            
            if start_date:
               try: range_start = datetime.strptime(start_date.split('T')[0], "%Y-%m-%d")
               except: pass
            
            if end_date:
               try: range_end = datetime.strptime(end_date.split('T')[0], "%Y-%m-%d")
               except: pass
            
            # If no start date, default to 1st of current month
            now = datetime.now()
            if not range_start:
               range_start = datetime(now.year, now.month, 1)
            
            # If no end date, default to last day of current month
            if not range_end:
               import calendar
               last_day = calendar.monthrange(now.year, now.month)[1]
               range_end = datetime(now.year, now.month, last_day)
               
            # Iterate through range
            # Iterate through range
            curr = range_start
            last_known_target = None
            
            # Use date() comparison to avoid time component issues
            while curr.date() <= range_end.date():
                d_str = curr.strftime("%Y-%m-%d")
                
                data = date_price_map.get(d_str)
                
                if data and data["target"] is not None:
                     # Update last known valid price (LOCF)
                    last_known_target = float(data["target"])
                    
                     # Deduplicate competitors by hotel name (keep first/latest price)
                    seen_hotels = set()
                    unique_competitors = []
                    comps = data.get("competitors") or []
                    for c in comps:
                        if c["name"] not in seen_hotels:
                            seen_hotels.add(c["name"])
                            unique_competitors.append(c)
                    
                    comp_avg = 0.0
                    vs_comp = 0.0
                    
                    if unique_competitors:
                        comp_avg = sum(float(c["price"]) for c in unique_competitors) / len(unique_competitors)
                        # Ensure target is float for subtraction
                        target_val = float(data["target"])
                        vs_comp = ((target_val - comp_avg) / comp_avg) * 100 if comp_avg > 0 else 0.0
                        
                    daily_prices.append({
                        "date": d_str,
                        "price": round(float(data["target"] or 0.0), 2), 
                        "comp_avg": round(float(comp_avg), 2),
                        "vs_comp": round(float(vs_comp), 1),
                        "competitors": unique_competitors
                    })
                else:
                    # Gap filling with partial or empty data
                    # Use existing data if available, otherwise defaults
                    unique_competitors = []
                    comp_avg = 0.0
                    target_val = None
                    target_price = 0.0
                    
                    # If we have a last known price, use it (LOCF Strategy)
                    # BUT ONLY for past/present dates (not future)
                    if last_known_target is not None and curr.date() <= datetime.now().date():
                        target_val = last_known_target
                        target_price = last_known_target
                    
                    if data:
                        # Even if no target, we might have competitors
                        comps = data.get("competitors") or []
                        seen_hotels = set()
                        for c in comps:
                            if c["name"] not in seen_hotels:
                                seen_hotels.add(c["name"])
                                unique_competitors.append(c)
                        
                        if unique_competitors:
                            comp_avg = sum(float(c["price"]) for c in unique_competitors) / len(unique_competitors)

                    # Ensure we ALWAYS append a record for the date
                    daily_prices.append({
                        "date": d_str,
                        "price": round(target_price, 2) if target_val is not None else None,
                        "comp_avg": round(float(comp_avg), 2),
                        "vs_comp": 0.0, # Neutral if data missing
                        "competitors": unique_competitors
                    })
                
                curr += timedelta(days=1)
                
            # Sort by date (already sequential, but safety)
            daily_prices.sort(key=lambda x: x["date"])

        # 6. Calculate Stats
        market_avg = sum(current_prices) / len(current_prices) if current_prices else 0.0
        market_min = min(current_prices) if current_prices else 0.0
        market_max = max(current_prices) if current_prices else 0.0
        
        # Ensure values are floats for rounding
        market_avg = float(market_avg)
        market_min = float(market_min)
        market_max = float(market_max)
        
        # Find min/max hotels for spread tooltip
        min_hotel = None
        max_hotel = None
        cheapest_competitor = None
        
        if price_rank_list:
            # Filter out target hotel from finding cheapest competitor
            others = [p for p in price_rank_list if str(p.get("id")) != target_hotel_id]
            if others:
                cheapest_competitor = others[0] # List is already sorted by price
                
            min_hotel = {"name": price_rank_list[0]["name"], "price": price_rank_list[0]["price"]}
            max_hotel = {"name": price_rank_list[-1]["name"], "price": price_rank_list[-1]["price"]}
        
        ari = (target_price / market_avg) * 100 if target_price and market_avg > 0 else 100.0
        
        avg_sentiment = sum(market_sentiments) / len(market_sentiments) if market_sentiments else 1.0
        sentiment_index = (target_sentiment / avg_sentiment) * 100 if target_sentiment and avg_sentiment > 0 else 100.0

        sorted_prices = sorted(current_prices)
        rank = sorted_prices.index(target_price) + 1 if target_price is not None and target_price in sorted_prices else 0
        
        # 7. Advisory & Quadrant
        # 7. Advisory & Quadrant Logic
        # Mapping: 100 is at center (0,0)
        # Use 50.0 (float) to satisfy linter expecting matching types for min/max
        q_x = max(-50.0, min(50.0, float(ari) - 100.0))
        q_y = max(-50.0, min(50.0, float(sentiment_index) - 100.0))
        
        # Quadrant Label Logic
        advisory_keys = []
        advisory = ""
        
        # Helper to safely convert price to int for display
        def safe_int_price(p):
            try:
                if p is None: return 0
                return int(float(p))
            except:
                return 0

        if ari >= 100 and sentiment_index >= 100:
            q_label = "Premium King"
            advisory = f"Strategic Peak: You are commanding a premium price (${safe_int_price(target_price)}) with superior sentiment."
            advisory_keys.append("premium")
        elif ari < 100 and sentiment_index >= 100:
            q_label = "Value Leader"
            diff = int(100 - ari)
            advisory = f"Expansion Opportunity: Your price is {diff}% below market avg despite high guest satisfaction."
            advisory_keys.append("value")
        elif ari >= 100 and sentiment_index < 100:
            q_label = "Danger Zone"
            diff = int(ari - 100)
            advisory = f"Caution: Your rate is {diff}% above market."
            if cheapest_competitor:
                 cmp_price = safe_int_price(cheapest_competitor['price'])
                 advisory += f" Compare with {cheapest_competitor['name']} (${cmp_price})."
            else:
                 advisory += " Guest sentiment does not support this premium."
            advisory_keys.append("danger")
        else: # Both < 100
            q_label = "Budget / Economy"
            diff = int(100 - ari)
            advisory = f"Volume Strategy: Your rate is {diff}% below market average."
            if sentiment_index < 85:
                advisory += " Recommendation: Focus on boosting guest sentiment before raising rates."
            else:
                advisory += " Recommendation: If occupancy is high, test a 5% daily rate increase."
            advisory_keys.append("volume")

        # Specific secondary advice
        if sentiment_index < 90:
            advisory += " Focus on reputation management."
            advisory_keys.append("reputation_focus")
        elif ari > 120:
             advisory += " Monitor competitors for aggressive price cuts."
             advisory_keys.append("aggressive_monitoring")
            
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
                                "stars": hotel.get("stars"),
                                "offers": prices[0].get("parity_offers") or prices[0].get("offers") or [],
                                "room_types": prices[0].get("room_types") or []
                            })
                    except Exception: continue

        # 9. All hotels list (for filter UI)
        all_hotels_list = [{"id": str(h["id"]), "name": h.get("name"), "is_target": str(h["id"]) == target_hotel_id} for h in hotels]

        # 10. Final Response
        target_h = next((h for h in hotels if str(h["id"]) == target_hotel_id), None)
        analysis_data = {
            "hotel_id": target_hotel_id,
            "hotel_name": target_hotel_name,
            "market_average": round(float(market_avg or 0.0), 2), # type: ignore
            "market_avg": round(float(market_avg or 0.0), 2),  # type: ignore
            "market_min": round(float(market_min or 0.0), 2), # type: ignore
            "market_max": round(float(market_max or 0.0), 2), # type: ignore
            "target_price": round(float(target_price), 2) if target_price is not None else None, # type: ignore
            "competitive_rank": rank,
            "market_rank": rank,  # NEW: for Market Spread UI
            "total_hotels": len(hotels),
            "competitors": competitors_list,
            "price_history": target_history,
            "display_currency": display_currency,
            "market_rank": rank,  # NEW: for Market Spread UI
            "total_hotels": len(hotels),
            "competitors": competitors_list,
            "price_history": target_history,
            "display_currency": display_currency,
            "ari": round(float(ari or 0.0), 1), # type: ignore
            "sentiment_index": round(float(sentiment_index or 0.0), 1), # type: ignore
            "sentimet_index": round(float(sentiment_index or 0.0), 1), # type: ignore
            "advisory_msg": advisory,
            "advisory_keys": advisory_keys,
            "quadrant_x": round(float(q_x), 1), # type: ignore
            "quadrant_y": round(float(q_y), 1), # type: ignore
            "quadrant_label": q_label,
            "target_rating": round(float(target_h.get("rating") or 0.0), 1) if target_h else 0.0, # type: ignore
            "market_rating": round(float(sum(float(h.get("rating") or 0) for h in hotels) / len(hotels)), 1) if hotels else 0.0, # type: ignore
            # NEW fields for enhanced UI
            "price_rank_list": price_rank_list,
            "daily_prices": daily_prices,
            "all_hotels": all_hotels_list,
            "min_hotel": min_hotel,
            "max_hotel": max_hotel,
            "sentiment_breakdown": _transform_serp_links(target_h.get("sentiment_breakdown")) if target_h else None,
            "guest_mentions": target_h.get("guest_mentions") if target_h else None,
            "available_room_types": sorted(list(available_room_types))
        }
        
        return JSONResponse(content=jsonable_encoder(analysis_data))

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"CRITICAL ANALYSIS ERROR: {e}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"error": "Analysis Fail", "detail": str(e), "trace": tb[:500]} # type: ignore
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

@app.get("/api/analysis/{hotel_id}/sentiment-history")
async def get_sentiment_history(
    hotel_id: str,
    days: int = Query(30, description="Number of days of history to fetch"),
    db: Client = Depends(get_supabase),
    current_active_user = Depends(get_current_active_user)
):
    """Fetch historical sentiment data for a specific hotel."""
    try:
        # Fetch from sentiment_history table
        res = db.table("sentiment_history")\
            .select("*")\
            .eq("hotel_id", hotel_id)\
            .order("recorded_at", desc=True)\
            .limit(days)\
            .execute()
        
        return JSONResponse(content={"history": res.data or []})
    except Exception as e:
        print(f"Sentiment history error: {e}")
        return JSONResponse(status_code=500, content={"error": "Sentiment History Fail", "detail": str(e)})

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

        # Filter out empty/legacy sessions if they have no useful data
        # Keep legacy only if they have hotels_count > 0 (or some other metric if available)
        final_sessions = [
            s for s in all_sessions 
            if s.get("hotels_count", 0) > 0 and s.get("session_type") != "legacy"
        ]
        # Fallback: if user wants SOME legacy, maybe only filter 0-count ones. 
        # User said "remove these scans that have no data". 
        # Usually legacy scans might have 0 hotels_count if synthesized from orphaned logs.
        # Let's strictly filter out sessions with 0 hotels or status='legacy' if that's what "no data" means.
        # Re-reading user request: "remove these scans that have no data".
        # Safe bet: filter out hotels_count == 0 or null.
        
        filtered_sessions: List[Dict[str, Any]] = [
            s for s in all_sessions 
            if (s.get("hotels_count") is not None and s.get("hotels_count") > 0)
        ]

        # 4. Synthesize Weekly Summary
        summary = {
            "total_scans": len(filtered_sessions),
            "active_monitors": 1, # Placeholder
            "last_week_trend": "Increasing",
            "system_health": "100%"
        }

        return JSONResponse(content=jsonable_encoder({
            "sessions": filtered_sessions[:100] if filtered_sessions else [], # type: ignore
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
async def get_api_key_status(user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
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
        
        # Add quota info
        status["quota_per_key"] = 250  # Monthly limit
        status["quota_period"] = "monthly"
        status["monthly_usage"] = monthly_usage
        
        # Merge individual key status from SerpApiClient
        detailed = serpapi_client.get_detailed_status()
        status["keys_status"] = detailed.get("keys_status", [])

        # Enrich with env debug (ADMIN ONLY)
        status["env_debug"] = {
            "SERPAPI_API_KEY": "Set" if os.getenv("SERPAPI_API_KEY") else "Missing",
            "SERPAPI_API_KEY_2": "Set" if os.getenv("SERPAPI_API_KEY_2") else "Missing",
            "SERPAPI_API_KEY_3": "Set" if os.getenv("SERPAPI_API_KEY_3") else "Missing"
        }
        
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
                "SERPAPI_API_KEY_3": "Set" if os.getenv("SERPAPI_API_KEY_3") else "Missing"
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


@app.patch("/api/admin/users/{user_id}")
async def admin_update_user(
    user_id: UUID, 
    updates: AdminUserUpdate, 
    user: Any = Depends(get_current_admin_user), 
    db: Client = Depends(get_supabase)
):
    """Admin: Update user details including schedule and settings."""
    # Force Service Role for Admin Actions (Bypass RLS)
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")

    try:
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
            # Sync to user_profiles
            db.table("user_profiles").update(profile_fields).eq("user_id", str(user_id)).execute()
            
            # Sync to legacy 'profiles' table for subscription status
            if "plan_type" in profile_fields or "subscription_status" in profile_fields:
                sub_update = {k: v for k, v in profile_fields.items() if k in ["plan_type", "subscription_status"]}
                db.table("profiles").update(sub_update).eq("id", str(user_id)).execute()

        # 2. Update Settings Fields (Schedule)
        settings_fields = {}
        if updates.check_frequency_minutes is not None: 
            settings_fields["check_frequency_minutes"] = updates.check_frequency_minutes
        
        if settings_fields:
            # Ensure settings exist
            existing = db.table("settings").select("user_id").eq("user_id", str(user_id)).execute()
            if not existing.data:
                db.table("settings").insert({
                    "user_id": str(user_id), 
                    **settings_fields,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat()
                }).execute()
            else:
                db.table("settings").update(settings_fields).eq("user_id", str(user_id)).execute()

        # 3. Update Auth Fields (Email/Password)
        auth_updates = {}
        if updates.email: auth_updates["email"] = updates.email
        if updates.password: auth_updates["password"] = updates.password
        
        if auth_updates:
            try:
                db.auth.admin.update_user_by_id(str(user_id), auth_updates)
            except Exception as auth_e:
                print(f"Auth sync failed: {auth_e}")

        return {"status": "success", "message": "User updated successfully"}
        
    except Exception as e:
        print(f"Admin Update User Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
        settings_data = db.table("settings").select("user_id, created_at, notification_email, check_frequency_minutes").execute().data or []
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
                    "created_at": p.get("created_at") or datetime.now().isoformat(),
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
                
                # Check created_at fallback
                if not users_map[uid].get("created_at"):
                     users_map[uid]["created_at"] = p.get("created_at") or datetime.now().isoformat()
                
        # Enrich with counts and schedule info
        final_users = []
        
        for uid, udata in users_map.items():
            try:
                # Count hotels
                h_count = db.table("hotels").select("id", count="exact").eq("user_id", uid).execute().count or 0
                s_count = db.table("scan_sessions").select("id", count="exact").eq("user_id", uid).execute().count or 0
                
                udata["hotel_count"] = h_count
                udata["scan_count"] = s_count
                
                # Schedule Logic - Fetch FRESH setting to ensure accuracy
                user_settings = next((s for s in settings_data if s["user_id"] == uid), None)
                
                # Default values
                udata["scan_frequency_minutes"] = 0
                udata["next_scan_at"] = None

                if user_settings:
                    freq = user_settings.get("check_frequency_minutes", 0)
                    udata["scan_frequency_minutes"] = freq
                    
                    if freq and freq > 0:
                        # Find last scan time
                        try:
                            last_log = db.table("scan_sessions") \
                                .select("created_at") \
                                .eq("user_id", uid) \
                                .order("created_at", desc=True) \
                                .limit(1) \
                                .execute()
                                
                            if last_log.data:
                                last_run_iso = last_log.data[0]["created_at"]
                                last_run = datetime.fromisoformat(last_run_iso.replace("Z", "+00:00"))
                                next_run = last_run + timedelta(minutes=freq)
                                udata["next_scan_at"] = next_run
                            else:
                                # Never scanned, so due now
                                udata["next_scan_at"] = datetime.now(timezone.utc)
                        except Exception as e:
                            print(f"Schedule Calc Error for {uid}: {e}")

                final_users.append(AdminUser(**udata))
            except Exception as user_err:
                print(f"Error processing user {uid}: {user_err}")
                final_users.append(AdminUser(**udata))
            
        return final_users
    except Exception as e:
        print(f"Admin Users Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


# ... create_admin_user ... skipped for snippet ...

@app.get("/api/admin/directory", response_model=List[AdminDirectoryEntry])
async def get_admin_directory(limit: int = 100, city: Optional[str] = None, db: Client = Depends(get_supabase)):
    """List directory entries."""
    if not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
    try:
        query = db.table("hotel_directory").select("*").order("created_at", desc=True).limit(limit)
        
        if city:
            # Filter by location containing the city name (case-insensitive if possible, but ILIKE is good)
            # Utilizing Supabase's ilike for location
            query = query.ilike("location", f"%{city}%")
            
        result = query.execute()
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
    for table in ["hotels", "scan_sessions", "user_profiles", "settings", "notifications", "reports"]:
        admin_db.table(table).delete().eq("user_id", str(user_id)).execute()
    
    # Delete from Auth
    try:
        admin_db.auth.admin.delete_user(str(user_id))
    except:
        pass # Ignore if auth user already gone
        
    return {"status": "success"}


# REDUNDANT ENDPOINT REMOVED
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


@app.get("/api/admin/feed")
async def get_admin_feed(limit: int = 50, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Get live agent feed logs."""
    # Force Service Role for Admin Actions (Bypass RLS)
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
        
    try:
        # Fetch generic query logs
        # We want the most recent activity across all sessions
        logs_res = db.table("query_logs") \
            .select("id, hotel_name, action_type, status, created_at, price, currency") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
            
        return logs_res.data or []
    except Exception as e:
        print(f"Admin Feed Error: {e}")
        # Return empty list on failure to keep UI alive
        return []

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
        

@app.get("/api/admin/scans/{scan_id}")
async def get_admin_scan_details(scan_id: str, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Get full details for a specific scan session."""
    # Force Service Role for Admin Actions (Bypass RLS)
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")
        
    try:
        # 1. Fetch Session
        session_res = db.table("scan_sessions").select("*").eq("id", scan_id).single().execute()
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Scan session not found")
        
        session = session_res.data
        
        # 2. Fetch Logs (Hotels Checked)
        logs_res = db.table("query_logs").select("*").eq("session_id", scan_id).execute()
        logs = logs_res.data or []
        
        # 3. Fetch Parity Offers (if we stored them in a separate table, otherwise they might be in logs or we mock them for now. 
        # In this project, parity offers seem to be part of the analysis result, likely stored in query_logs or computed.
        # Looking at schema, query_logs has 'parity_offers' JSONB column in some versions, or we just rely on logs.)
        
        return {
            "session": session,
            "logs": logs
        }
    except Exception as e:
        print(f"Admin Scan Details Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


import time


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


@app.get("/api/admin/scheduler/queue", response_model=List[SchedulerQueueEntry])
async def get_scheduler_queue(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """Fetch upcoming scheduled scans for all active users."""
    # Force Service Role for Admin Actions
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if admin_key and url:
        db = create_client(url, admin_key)
    elif not db:
        raise HTTPException(status_code=503, detail="Database credentials missing.")

    try:
        # 1. Fetch all users with frequencies > 0
        settings_res = db.table("settings").select("user_id, check_frequency_minutes").gt("check_frequency_minutes", 0).execute()
        user_settings = settings_res.data or []
        
        if not user_settings:
            return []
            
        user_ids = [s["user_id"] for s in user_settings]
        
        # 2. Fetch user names
        profiles_res = db.table("user_profiles").select("user_id, display_name").in_("user_id", user_ids).execute()
        profiles_map = {p["user_id"]: p.get("display_name", "Unknown") for p in (profiles_res.data or [])}
        
        # 3. Fetch hotel counts
        hotels_res = db.table("hotels").select("user_id, name").in_("user_id", user_ids).execute()
        hotels_data = hotels_res.data or []
        user_hotels = {}
        for h in hotels_data:
            uid = h["user_id"]
            if uid not in user_hotels: user_hotels[uid] = []
            user_hotels[uid].append(h["name"])
            
        # 4. Fetch latest scan sessions
        sessions_res = db.table("scan_sessions") \
            .select("user_id, created_at, status") \
            .in_("user_id", user_ids) \
            .order("created_at", desc=True) \
            .execute()
            
        # Group by user (first one is latest)
        latest_sessions = {}
        for s in (sessions_res.data or []):
            if s["user_id"] not in latest_sessions:
                latest_sessions[s["user_id"]] = s
                
        # 5. Build Queue Entries
        queue = []
        now = datetime.now(timezone.utc)
        
        for s in user_settings:
            uid = s["user_id"]
            freq = s["check_frequency_minutes"]
            last_session = latest_sessions.get(uid)
            
            last_scan_at = None
            next_scan_at = None
            status = "pending"
            
            if last_session:
                last_scan_at = datetime.fromisoformat(last_session["created_at"].replace("Z", "+00:00"))
                next_scan_at = last_scan_at + timedelta(minutes=freq)
                
                if last_session["status"] == "processing" or last_session["status"] == "queued":
                    status = "running"
                elif next_scan_at < now:
                    status = "overdue"
            else:
                # Never scanned, due now
                next_scan_at = now
                status = "pending"
                
            queue.append(SchedulerQueueEntry(
                user_id=uid,
                user_name=profiles_map.get(uid) or f"User {str(uid)[0:8]}",
                scan_frequency_minutes=freq,
                last_scan_at=last_scan_at,
                next_scan_at=next_scan_at,
                status=status,
                hotel_count=len(user_hotels.get(uid, [])),
                hotels=list(user_hotels.get(uid, []))[:5] # type: ignore
            ))
            
        # Sort by next_scan_at
        queue.sort(key=lambda x: x.next_scan_at)
        
        return queue
        
    except Exception as e:
        print(f"Scheduler Queue Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ... (imports already exist in main.py)

@app.get("/api/admin/market-intelligence")
async def get_market_intelligence(
    city: str = Query(..., description="City to filter by"),
    limit: int = 100,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """
    Get aggregated market intelligence for a specific city.
    Sources from 'hotel_directory' (or 'hotels' if directory incomplete).
    """
    try:
        # 1. Fetch hotels in city (limit for map performance)
        # Prioritize 'hotels' table (Real scanned data with coordinates/prices)
        hotels_query = db.table("hotels") \
            .select("id, name, location, latitude, longitude, rating, stars") \
            .ilike("location", f"%{city}%") \
            .limit(limit) \
            .execute()
        
        hotels = hotels_query.data or []
        
        if not hotels:
            # Fallback to directory if no scanned data (broader view, but likely no coords/prices)
            hotels_query = db.table("hotel_directory") \
                .select("id, name, location, rating, stars, created_at") \
                .ilike("location", f"%{city}%") \
                .limit(limit) \
                .execute()
            hotels = hotels_query.data or []

        # 2. Real Data Processing
        # In production, we'd join with a `directory_prices` table or similar.
        # For now, we trust the data we have or default to legitimate placeholders (not random)
        enriched_hotels = []
        prices = []
        
        for h in hotels:
            # Use actual price if we had it, otherwise None/0
            # We are not mocking anymore.
            current_price = h.get("latest_price", 0) 
            if current_price and current_price > 0:
                prices.append(current_price)
                
            enriched_hotels.append({
                **h,
                "latest_price": current_price,
                # Use actual rating from DB (which might be null)
                "rating": h.get("rating")
            })

        # 3. Calculate Summary Metrics
        if prices:
            avg_price = sum(prices) / len(prices)
            min_price = min(prices)
            max_price = max(prices)
        else:
            avg_price = 0
            min_price = 0
            max_price = 0

        # Scan Coverage (Mock: % of hotels that satisfy some condition)
        # In real world: count(hotels with recent price_logs) / total_hotels
        scan_coverage_pct = 78.5 # Placeholder based on system health

        return {
            "summary": {
                "hotel_count": len(hotels),
                "avg_price": round(float(avg_price), 2), # type: ignore
                "price_range": [min_price, max_price],
                "scan_coverage_pct": scan_coverage_pct
            },
            "hotels": enriched_hotels
        }

    except Exception as e:
        print(f"Market Intelligence Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ... (imports already exist in main.py)
from datetime import timedelta

class ReportRequest(BaseModel):
    hotel_ids: List[str]
    period_months: int
    title: Optional[str] = None
    comparison_mode: bool = False

@app.post("/api/admin/reports/generate")
async def generate_report(
    req: ReportRequest,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """
    Generate a comprehensive report (single or comparison) with AI insights.
    """
    try:
        # 1. Fetch Data for Each Hotel
        report_data = []
        end_date = datetime.now()
        start_date = end_date - timedelta(days=req.period_months * 30)
        
        for hotel_id in req.hotel_ids:
            # Get Hotel Details
            h_data = None
            try:
                # Try hotels (UUID)
                hotel = db.table("hotels").select("*").eq("id", hotel_id).single().execute()
                h_data = hotel.data
            except Exception:
                # Might fail if hotel_id is not UUID (e.g. directory ID)
                pass
                
            if not h_data:
                try:
                    # Try directory (Integer ID)
                    hotel = db.table("hotel_directory").select("*").eq("id", hotel_id).single().execute()
                    h_data = hotel.data
                except Exception:
                    pass
            
            if not h_data:
                continue # Skip if not found in either
            
            # Get Price History
            # Note: mocking history if not available for directory hotels
            # In production: query price_logs
            logs = db.table("price_logs").select("price, recorded_at") \
                .eq("hotel_id", hotel_id) \
                .gte("recorded_at", start_date.isoformat()) \
                .order("recorded_at") \
                .execute()
            
            price_history = logs.data or []
            
            # Calculate metrics
            if price_history:
                prices = [p["price"] for p in price_history]
                avg_price = sum(prices) / len(prices)
                min_price = min(prices)
                max_price = max(prices)
            else:
                avg_price = 0
                min_price = 0
                max_price = 0

            report_data.append({
                "hotel": h_data,
                "metrics": {
                    "avg_price": round(float(avg_price), 2), # type: ignore
                    "min_price": min_price,
                    "max_price": max_price,
                    "data_points": len(price_history)
                },
                "history": list(price_history)[-30:] # type: ignore
            })

        # 2. Generate AI Insights (Gemini)
        # We construct a prompt based on the aggregated data
        
        prompt = f"Analyze these hotels for a {req.period_months}-month report:\n"
        for item in report_data:
            h = item['hotel']
            m = item['metrics']
            prompt += f"- {h.get('name', 'Hotel')}: Avg Price ${m['avg_price']}, Range ${m['min_price']}-${m['max_price']}\n"
            
        prompt += "\nIdentify competitive advantages, pricing anomalies, and actionable recommendations."

        # 2. Generate AI Insights (Gemini)
        import google.generativeai as genai
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        ai_insights = []
        
        if gemini_key:
            try:
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                
                prompt = (
                    f"Act as a Hotel Revenue Manager. Analyze these hotels for a {req.period_months}-month report:\n"
                )
                
                for item in report_data:
                    h = item['hotel']
                    m = item['metrics']
                    prompt += f"- {h.get('name', 'Hotel')}: Avg Price ${m['avg_price']}, Range ${m['min_price']}-${m['max_price']}, Data points: {m['data_points']}\n"
                    
                prompt += (
                    "\nProvide 3 distinct, actionable insights in a JSON array of strings format. "
                    "Focus on competitive advantages, pricing anomalies, and recommendations. "
                    "Do not include markdown formatting, just the raw list."
                )

                response = model.generate_content(prompt)
                
                # Simple parsing attempt (resilient to markdown blocks)
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text.replace("```json", "").replace("```", "")
                if text.startswith("["):
                    import json
                    ai_insights = json.loads(text)
                else:
                    # Fallback if not JSON
                    ai_insights_list: List[str] = [line.strip("- *") for line in text.split("\n") if line.strip()]
                    ai_insights = ai_insights_list[:3] # type: ignore
                    
            except Exception as ai_e:
                print(f"Gemini AI Error: {ai_e}")
                ai_insights = ["AI Insights currently unavailable.", "Please check API configuration."]
        else:
            ai_insights = ["AI Analysis skipped (API Key missing)."]


        # 3. Save Report to DB
        report_entry = {
            "report_type": "comparison" if req.comparison_mode else "single",
            "hotel_ids": req.hotel_ids,
            "period_months": req.period_months,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "report_data": {
                "hotels": report_data,
                "ai_insights": ai_insights
            },
            "title": req.title or f"Market Report - {end_date.strftime('%Y-%m-%d')}",
            "created_by": admin.id  # Assuming admin search object has ID
        }
        
        result = db.table("reports").insert(report_entry).execute()
        
        return {
            "status": "success", 
            "report_id": result.data[0]["id"],
            "data": result.data[0]
        }

    except Exception as e:
        print(f"Report Generation Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ... (imports already exist)
from fastapi.responses import Response

@app.get("/api/admin/reports/{report_id}/pdf")
async def export_report_pdf(
    report_id: UUID,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """
    Generate and stream a PDF for a specific report.
    """
    try:
        # 1. Fetch Report Data
        report = db.table("reports").select("*").eq("id", str(report_id)).single().execute()
        if not report.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        data = report.data
        report_data = data["report_data"]
        
        # 2. Render HTML Template
        # In a real app, use Jinja2. Here we construct a simple HTML string.
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Helvetica', sans-serif; color: #333; padding: 40px; }}
                h1 {{ color: #047857; border-bottom: 2px solid #047857; padding-bottom: 10px; }}
                h2 {{ color: #333; margin-top: 30px; }}
                .meta {{ color: #666; font-size: 0.9em; margin-bottom: 30px; }}
                .insight {{ background: #ecfdf5; padding: 15px; border-left: 4px solid #047857; margin-bottom: 10px; }}
                .hotel-card {{ border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }}
                .metric {{ font-size: 1.2em; font-weight: bold; }}
                .label {{ font-size: 0.8em; color: #666; text-transform: uppercase; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #eee; }}
            </style>
        </head>
        <body>
            <h1>{data.get('title', 'Market Analysis Report')}</h1>
            <div class="meta">
                Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}<br/>
                Includes: {len(data.get('hotel_ids', []))} hotels | Period: {data.get('period_months')} months
            </div>

            <h2>🤖 AI Executive Summary</h2>
            {"".join([f'<div class="insight">{insight}</div>' for insight in report_data.get("ai_insights", [])])}

            <h2>🏨 Hotel Analysis</h2>
            {"".join([
                f'''
                <div class="hotel-card">
                    <h3>{h['hotel'].get('name', 'Unknown Hotel')}</h3>
                    <p>{h['hotel'].get('location', '')}</p>
                    <table style="width:100%">
                        <tr>
                            <td>
                                <div class="metric">${h['metrics']['avg_price']}</div>
                                <div class="label">Avg Price</div>
                            </td>
                            <td>
                                <div class="metric">${h['metrics']['min_price']} - ${h['metrics']['max_price']}</div>
                                <div class="label">Price Range</div>
                            </td>
                             <td>
                                <div class="metric">{h['metrics']['data_points']}</div>
                                <div class="label">Data Points</div>
                            </td>
                        </tr>
                    </table>
                </div>
                ''' for h in report_data.get("hotels", [])
            ])}
            
            <div style="margin-top: 50px; text-align: center; color: #999; font-size: 0.8em;">
                Generated by Tripzy.travel Intelligence Hub
            </div>
        </body>
        </html>
        """

        # 3. Generate PDF
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=html_content).write_pdf()
        except ImportError:
            print("PDF Error: weasyprint not installed (Skipping PDF Generation)")
            raise HTTPException(
                status_code=501, 
                detail="PDF generation is currently unavailable on this environment (weasyprint missing)."
            )
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=report_{report_id}.pdf"}
        )

    except Exception as e:
        print(f"PDF Generation Error: {e}")
        # Return text error for debugging if PDF fails (e.g. missing GTK)
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")

@app.get("/api/admin/reports")
async def get_admin_reports(
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """List all saved reports."""
    try:
        # Fetch reports sorted by creation date
        result = db.table("reports").select("id, title, report_type, created_at, report_data").order("created_at", desc=True).execute()
        return result.data or []
    except Exception as e:
        print(f"Get Reports Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------------------------------------------------------
# SCHEDULER & CRON ENDPOINTS
# -----------------------------------------------------------------------------

@app.get("/api/cron")
async def trigger_cron_job(
    key: str = Query(..., description="Secret Cron Key"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Public-facing endpoint for external cron services (GitHub Actions, Vercel Cron).
    Triggers the internal scheduler logic to check and run due scans.
    """
    cron_secret = os.getenv("CRON_SECRET", "super_secret_cron_key_123")
    if key != cron_secret:
        raise HTTPException(status_code=403, detail="Invalid Cron Key")
    
    # Logic to trigger pending scans
    # In a real scenario, this would import a scheduler service. 
    # Here, we'll inline the logic to check user schedules and queue jobs.
    
    background_tasks.add_task(run_scheduler_check)
    return {"status": "success", "message": "Scheduler triggered in background"}

async def run_scheduler_check():
    """
    Internal function to check all users for due scans and trigger them.
    """
    print(f"[{datetime.now()}] CRON: Starting scheduler check...")
    try:
        supabase = await get_supabase()
        
        # 1. Get all active users with schedules due
        # We query 'users' (table mapping to profiles) 
        # Note: In Supabase, 'auth.users' is protected. We use 'profiles' or 'user_profiles'.
        # Assuming 'profiles' has 'next_scan_at' and 'scan_frequency_minutes'
        
        result = supabase.table("profiles").select("id, next_scan_at, scan_frequency_minutes, subscription_status") \
            .lte("next_scan_at", datetime.now().isoformat()) \
            .eq("subscription_status", "active") \
            .execute()
        
        due_users = result.data or []
        print(f"[{datetime.now()}] CRON: Found {len(due_users)} users due for scan.")
        
        for user in due_users:
            try:
                user_id = user['id']
                print(f" - Processing user {user_id}...")

                # 2. Update next_scan_at immediately (Locking mechanism)
                # Default to 24h if missing
                freq = user.get("scan_frequency_minutes") or 1440 
                next_run = datetime.now() + timedelta(minutes=freq)
                
                supabase.table("profiles").update({"next_scan_at": next_run.isoformat()}).eq("id", user_id).execute()
                
                # 3. Trigger Scraper Agent
                # We need to run this in a way that doesn't block the loop forever, 
                # but 'await' is fine here as this function runs in background_tasks
                
                scraper = ScraperAgent(user_id=UUID(user_id))
                # Passing 'scheduled' context if supported, or just running scan
                await scraper.run_full_scan()
                
                print(f" - Scan completed for user {user_id}")
                
            except Exception as u_e:
                print(f" - Error processing user {user.get('id')}: {u_e}")
                
    except Exception as e:
        print(f"CRON ERROR: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
