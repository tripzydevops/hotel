import os
import asyncio
import json
from uuid import UUID
from datetime import date
from dotenv import load_dotenv
from supabase import create_client

# Mock dependencies
load_dotenv('.env.local')
url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(url, key)

async def verify_analysis_data():
    print("Verifying Analysis Data Logic...")
    
    # 1. Get User ID (we'll query for the Hilton hotel's user)
    hilton_res = supabase.table("hotels").select("*").ilike("name", "%Hilton%").execute()
    if not hilton_res.data:
        print("Hilton hotel not found")
        return
        
    user_id = hilton_res.data[0]["user_id"]
    hotel_id = hilton_res.data[0]["id"]
    print(f"User ID: {user_id}")
    print(f"Hilton Hotel ID: {hotel_id}")

    # 2. Simulate logic in analysis_routes.py
    hotels_result = supabase.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    hotels = hotels_result.data or []
    
    print(f"Found {len(hotels)} hotels for user.")
    
    # New Logic
    price_logs_res = supabase.table("price_logs") \
        .select("*") \
        .in_("hotel_id", [str(h["id"]) for h in hotels]) \
        .order("recorded_at", desc=True) \
        .limit(10) \
        .execute()
        
    logs_data = price_logs_res.data or []
    print(f"Fetched {len(logs_data)} price logs (limit 10 for view).")
    
    # Group logs
    hotel_prices_map = {}
    for log in logs_data:
        hid = str(log["hotel_id"])
        if hid not in hotel_prices_map:
            hotel_prices_map[hid] = []
        hotel_prices_map[hid].append(log)
        
    # Check Hilton
    hilton_logs = hotel_prices_map.get(hotel_id, [])
    print(f"Hilton has {len(hilton_logs)} logs in the sample.")
    
    if len(hilton_logs) > 0:
        log = hilton_logs[0]
        print("Sample Log keys:", log.keys())
        print("Sample Price:", log.get("price"))
        print("Sample Recorded At:", log.get("recorded_at"))
        print("Sample Check In:", log.get("check_in_date"))
        
        if log.get("price") is not None:
             print("SUCCESS: Price data available.")
        else:
             print("WARNING: Price is None.")
    else:
        print("FAIL: No logs for Hilton in top 1000 (simulated).")

if __name__ == "__main__":
    asyncio.run(verify_analysis_data())
