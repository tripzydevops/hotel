"""
Hotel Rate Monitor - FastAPI Backend
Main application with monitoring and API endpoints.
"""

import os
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID
from dotenv import load_dotenv
from supabase import create_client, Client

from backend.models import (
    Hotel, HotelCreate, HotelUpdate,
    PriceLog, PriceLogCreate,
    Settings, SettingsUpdate,
    Alert, AlertCreate,
    DashboardResponse, HotelWithPrice, MonitorResult,
    DashboardResponse, HotelWithPrice, MonitorResult,
    TrendDirection
)
from backend.services import serpapi_client, price_comparator, notification_service

load_dotenv()

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

# Supabase client
def get_supabase() -> Client:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)


# ===== Health Check =====

@app.get("/api/health")
async def health_check():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    has_key = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
    return {
        "status": "healthy", 
        "supabase_configured": bool(url and has_key),
        "timestamp": datetime.now().isoformat()
    }


# ===== Dashboard Endpoint =====

@app.get("/api/dashboard/{user_id}", response_model=DashboardResponse)
async def get_dashboard(user_id: UUID, db: Client = Depends(get_supabase)):
    """Get dashboard data with target hotel and competitors."""
    
    # Fetch all hotels for user
    hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    hotels = hotels_result.data or []
    
    target_hotel = None
    competitors = []
    
    for hotel in hotels:
        # Get latest 2 prices for trend calculation
        prices_result = db.table("price_logs") \
            .select("*") \
            .eq("hotel_id", hotel["id"]) \
            .order("recorded_at", desc=True) \
            .limit(2) \
            .execute()
        
        prices = prices_result.data or []
        current_price = prices[0] if prices else None
        previous_price = prices[1] if len(prices) > 1 else None
        
        # Build price info with trend
        price_info = None
        if current_price:
            current = current_price["price"]
            previous = previous_price["price"] if previous_price else None
            trend, change = price_comparator.calculate_trend(current, previous)
            
            price_info = {
                "current_price": current,
                "previous_price": previous,
                "currency": current_price.get("currency", "USD"),
                "trend": trend.value,
                "change_percent": change,
                "recorded_at": current_price["recorded_at"],
            }
        
        hotel_with_price = HotelWithPrice(
            id=hotel["id"],
            name=hotel["name"],
            is_target_hotel=hotel["is_target_hotel"],
            location=hotel.get("location"),
            price_info=price_info,
        )
        
        if hotel["is_target_hotel"]:
            target_hotel = hotel_with_price
        else:
            competitors.append(hotel_with_price)
    
    # Count unread alerts
    alerts_result = db.table("alerts") \
        .select("id", count="exact") \
        .eq("user_id", str(user_id)) \
        .eq("is_read", False) \
        .execute()
    
    unread_count = 0
    try:
        unread_count = alerts_result.count if alerts_result.count is not None else 0
    except:
        pass
    
    return DashboardResponse(
        target_hotel=target_hotel,
        competitors=competitors[:5],  # Limit to 5 competitors
        unread_alerts_count=unread_count,
        last_updated=datetime.now(),
    )


# ===== Monitor Endpoint =====

@app.post("/api/monitor/{user_id}", response_model=MonitorResult)
async def trigger_monitor(
    user_id: UUID,
    check_in: Optional[date] = None,
    db: Client = Depends(get_supabase)
):
    """
    Trigger price monitoring for all hotels of a user.
    Fetches current prices from SerpApi and compares against history.
    """
    errors = []
    prices_updated = 0
    alerts_generated = 0
    
    # Get user settings
    settings = None
    try:
        settings_result = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
        if settings_result.data:
            settings = settings_result.data[0]
    except Exception as e:
        print(f"Error fetching settings: {e}")
        
    threshold = settings["threshold_percent"] if settings else 2.0
    
    # Get all hotels for user
    hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    hotels = hotels_result.data or []
    
    if not hotels:
        return MonitorResult(hotels_checked=0, prices_updated=0, alerts_generated=0)
    
    # Find target hotel price for competitor comparison
    target_price = None
    
    for hotel in hotels:
        hotel_id = hotel["id"]
        hotel_name = hotel["name"]
        location = hotel.get("location", "")
        
        try:
            # Fetch current price from SerpApi
            price_data = await serpapi_client.fetch_hotel_price(
                hotel_name=hotel_name,
                location=location,
                check_in=check_in,
            )
            
            if not price_data:
                errors.append(f"Could not fetch price for {hotel_name}")
                continue
            
            current_price = price_data["price"]
            currency = price_data.get("currency", "USD")
            
            # Get previous price
            prev_result = db.table("price_logs") \
                .select("price") \
                .eq("hotel_id", hotel_id) \
                .order("recorded_at", desc=True) \
                .limit(1) \
                .execute()
            
            previous_price = prev_result.data[0]["price"] if prev_result.data else None
            
            # Log new price
            db.table("price_logs").insert({
                "hotel_id": hotel_id,
                "price": current_price,
                "currency": currency,
                "check_in_date": (check_in or date.today()).isoformat(),
                "source": "serpapi",
            }).execute()
            
            prices_updated += 1
            
            # Track target hotel price
            if hotel["is_target_hotel"]:
                target_price = current_price
            
            # Check for threshold breach
            if previous_price:
                threshold_alert = price_comparator.check_threshold_breach(
                    current_price, previous_price, threshold
                )
                if threshold_alert:
                    # Save alert
                    db.table("alerts").insert({
                        "user_id": str(user_id),
                        "hotel_id": hotel_id,
                        **threshold_alert,
                    }).execute()
                    alerts_generated += 1
                    
                    # Send notification via all enabled channels
                    if settings:
                        await notification_service.send_notifications(
                            settings=settings,
                            hotel_name=hotel_name,
                            alert_message=threshold_alert["message"],
                            current_price=threshold_alert["new_price"],
                            previous_price=threshold_alert["old_price"],
                            currency=currency
                        )
        
        except Exception as e:
            errors.append(f"Error processing {hotel_name}: {str(e)}")
    
    # Second pass: check competitor undercuts
    if target_price:
        for hotel in hotels:
            if hotel["is_target_hotel"]:
                continue
            
            # Get latest price for competitor
            latest = db.table("price_logs") \
                .select("price") \
                .eq("hotel_id", hotel["id"]) \
                .order("recorded_at", desc=True) \
                .limit(2) \
                .execute()
            
            if not latest.data:
                continue
            
            current = latest.data[0]["price"]
            previous = latest.data[1]["price"] if len(latest.data) > 1 else None
            
            undercut = price_comparator.check_competitor_undercut(
                target_price, hotel["name"], current, previous
            )
            if undercut:
                db.table("alerts").insert({
                    "user_id": str(user_id),
                    "hotel_id": hotel["id"],
                    **undercut,
                }).execute()
                alerts_generated += 1
                
                # Send notification via all enabled channels
                if settings:
                    await notification_service.send_notifications(
                        settings=settings,
                        hotel_name=hotel["name"],
                        alert_message=undercut["message"],
                        current_price=undercut["new_price"],
                        previous_price=undercut["old_price"] or 0
                    )
    
    return MonitorResult(
        hotels_checked=len(hotels),
        prices_updated=prices_updated,
        alerts_generated=alerts_generated,
        errors=errors,
    )


# ===== Hotels CRUD =====

@app.get("/api/hotels/{user_id}", response_model=List[Hotel])
async def list_hotels(user_id: UUID, db: Client = Depends(get_supabase)):
    result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    return result.data or []


@app.post("/api/hotels/{user_id}", response_model=Hotel)
async def create_hotel(user_id: UUID, hotel: HotelCreate, db: Client = Depends(get_supabase)):
    # If this is a target hotel, unset any existing target
    if hotel.is_target_hotel:
        db.table("hotels") \
            .update({"is_target_hotel": False}) \
            .eq("user_id", str(user_id)) \
            .eq("is_target_hotel", True) \
            .execute()
    
    result = db.table("hotels").insert({
        "user_id": str(user_id),
        **hotel.model_dump(),
    }).execute()
    
    return result.data[0]


@app.patch("/api/hotels/{hotel_id}")
async def update_hotel(hotel_id: UUID, hotel: HotelUpdate, db: Client = Depends(get_supabase)):
    update_data = {k: v for k, v in hotel.model_dump().items() if v is not None}
    result = db.table("hotels").update(update_data).eq("id", str(hotel_id)).execute()
    return result.data[0] if result.data else None


@app.delete("/api/hotels/{hotel_id}")
async def delete_hotel(hotel_id: UUID, db: Client = Depends(get_supabase)):
    db.table("hotels").delete().eq("id", str(hotel_id)).execute()
    return {"status": "deleted"}

# ===== Settings CRUD =====

@app.get("/api/settings/{user_id}", response_model=Settings)
async def get_settings(user_id: UUID, db: Client = Depends(get_supabase)):
    try:
        result = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
        if not result.data:
            # Create default settings if none exist
            default_settings = {
                "user_id": str(user_id),
                "threshold_percent": 2.0,
                "check_frequency_minutes": 144,
                "notifications_enabled": True
            }
            result = db.table("settings").insert(default_settings).execute()
            return result.data[0]
        return result.data[0]
    except Exception as e:
        print(f"Error in get_settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/settings/{user_id}", response_model=Settings)
async def update_settings(user_id: UUID, settings: SettingsUpdate, db: Client = Depends(get_supabase)):
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


# ===== Alerts =====

@app.get("/api/alerts/{user_id}", response_model=List[Alert])
async def list_alerts(user_id: UUID, unread_only: bool = False, db: Client = Depends(get_supabase)):
    query = db.table("alerts").select("*").eq("user_id", str(user_id))
    if unread_only:
        query = query.eq("is_read", False)
    result = query.order("created_at", desc=True).limit(50).execute()
    return result.data or []


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
        freq_minutes = user_setting.get("check_frequency_minutes", 1440) # Default daily
        
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
                # Trigger monitor (we await it here, but could push to background)
                # For Serverless with 10s timeout, best to run explicitly or spawn simple task
                # Re-using the logic from trigger_monitor
                await trigger_monitor(UUID(user_id), None, db)
                results["triggered"] += 1
            else:
                results["skipped"] += 1
                
        except Exception as e:
            print(f"Error in cron for user {user_id}: {e}")
            results["errors"].append(str(e))
            
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
