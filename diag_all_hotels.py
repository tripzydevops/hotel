
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timezone

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diag_all_hotels():
    print("--- Diagnostic: Scan Status for All Hotels ---")
    
    # 1. Get all hotels for the user (assuming one user for now, or fetch all)
    hotels_res = supabase.table("hotels").select("*").execute()
    hotels = hotels_res.data or []
    print(f"Total Hotels: {len(hotels)}")

    for h in hotels:
        hid = h["id"]
        is_target = h.get("is_target_hotel", False)
        print(f"\nHotel: {h['name']} (ID: {hid}) [{'TARGET' if is_target else 'COMP'}]")
        
        # Latest price log
        latest_res = supabase.table("price_logs") \
            .select("recorded_at, check_in_date, price") \
            .eq("hotel_id", hid) \
            .order("recorded_at", desc=True) \
            .limit(1) \
            .execute()
        
        if latest_res.data:
            latest = latest_res.data[0]
            print(f"  Last Scan Recorded: {latest['recorded_at']}")
            print(f"  Last Check-in Date: {latest['check_in_date']}")
            print(f"  Last Price: {latest['price']}")
        else:
            print("  No price logs found")

    # 2. Check for any failed scans in a 'scans' table if it exists
    try:
        # Check if there is a 'scans' or 'logs' table
        tables_res = supabase.rpc("get_tables").execute() # Might not work
    except:
        pass

if __name__ == "__main__":
    asyncio.run(diag_all_hotels())
