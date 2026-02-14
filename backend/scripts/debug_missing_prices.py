import asyncio
import os
import sys

# Ensure backend modules can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.utils.db import get_supabase

async def debug_missing_prices():
    print("Debug: Checking price history for Ramada and Hilton for Feb 13...")
    db = get_supabase()
    
    # 1. Get Hotel IDs
    hotels = db.table("hotels").select("id, name").ilike("name", "%Ramada%").execute()
    ramada = hotels.data[0] if hotels.data else None
    
    hotels = db.table("hotels").select("id, name").ilike("name", "%Hilton%").execute()
    hilton = hotels.data[0] if hotels.data else None
    
    hotels = db.table("hotels").select("id, name").ilike("name", "%Altin%").execute()
    altin = hotels.data[0] if hotels.data else None

    # Target Check-in Date
    target_date = "2026-02-13"
    
    for h in [ramada, hilton, altin]:
        if not h: continue
        print(f"\n--- Checking {h['name']} ({h['id']}) for Check-in {target_date} ---")
        
        # Query ALL logs for this check-in date
        res = db.table("price_logs") \
            .select("*") \
            .eq("hotel_id", h["id"]) \
            .eq("check_in_date", target_date) \
            .order("recorded_at", desc=True) \
            .execute()
            
        logs = res.data or []
        print(f"Found {len(logs)} logs for {target_date}:")
        for log in logs:
            print(f"  - Price: {log['price']} {log['currency']}")
            print(f"    Recorded At: {log['recorded_at']}")
            print(f"    Source: {log['source']} / {log['vendor']}")
            print(f"    Is Estimated: {log.get('is_estimated')}")
            print(f"    Room Types: {log.get('room_types')}")
            print("")

if __name__ == "__main__":
    asyncio.run(debug_missing_prices())
