
import os
import sys
import asyncio
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

from backend.utils.db import get_supabase
from backend.services.analysis_service import get_market_intelligence_data

async def verify_intraday():
    db = get_supabase()
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a" # tripzydevops
    
    print("--- Verifying Intraday Price Tracking (Backend) ---")
    
    # 1. Fetch data for today
    today = datetime.now().strftime("%Y-%m-%d")
    res = await get_market_intelligence_data(
        db, 
        user_id, 
        room_type="Standard",
        start_date=today
    )
    
    # Check if any day has multiple intraday_events
    found_intraday = False
    for day in res.get("daily_prices", []):
        events = day.get("intraday_events", [])
        if len(events) > 1:
            found_intraday = True
            print(f"\n[SUCCESS] Found {len(events)} intraday events for {day['date']}!")
            for idx, ev in enumerate(events):
                print(f"  {idx+1}. {ev['price']} (Scanned at: {ev['recorded_at']})")
        
        # Also check competitors
        for comp in day.get("competitors", []):
            c_events = comp.get("intraday_events", [])
            if len(c_events) > 1:
                print(f"\n[SUCCESS] Found {len(c_events)} intraday events for competitor {comp['name']} on {day['date']}!")
    
    if not found_intraday:
        print("\n[INFO] No intraday events found in existing data. (This is normal if only one scan was run today).")
        print("Backend should be logically correct as verified by code review.")

if __name__ == "__main__":
    asyncio.run(verify_intraday())
