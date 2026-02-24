
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diag():
    hid = "838f4714-4cfa-4ff7-bad2-67f3960667bf" # Ramada Residences ID
    print(f"--- Diag for Ramada Residences ({hid}) ---")
    
    # Check for check-in dates in Jan 2027
    print("\nChecking for check-in dates in Jan 2027...")
    jan_res = supabase.table("price_logs") \
        .select("recorded_at, check_in_date, price, room_types") \
        .eq("hotel_id", hid) \
        .gte("check_in_date", "2027-01-01") \
        .lte("check_in_date", "2027-01-31") \
        .order("recorded_at", desc=True) \
        .execute()
    
    if jan_res.data:
        print(f"Found {len(jan_res.data)} logs for Jan 2027.")
        for log in jan_res.data[:5]:
            print(f"  Check-in: {log['check_in_date']} | Recorded: {log['recorded_at']} | Price: {log['price']}")
    else:
        print("No logs found for Jan 2027 via local ID. Checking via serp_api_id...")
        h_res = supabase.table("hotels").select("serp_api_id").eq("id", hid).execute()
        serp_id = h_res.data[0].get("serp_api_id")
        if serp_id:
            jan_res_global = supabase.table("price_logs") \
                .select("recorded_at, check_in_date, price, room_types") \
                .eq("serp_api_id", serp_id) \
                .gte("check_in_date", "2027-01-01") \
                .lte("check_in_date", "2027-01-31") \
                .order("recorded_at", desc=True) \
                .execute()
            if jan_res_global.data:
                print(f"Found {len(jan_res_global.data)} logs for Jan 2027 via Global ID.")
                for log in jan_res_global.data[:5]:
                    print(f"  Check-in: {log['check_in_date']} | Recorded: {log['recorded_at']} | Price: {log['price']}")
            else:
                print("Still no logs found for Jan 2027.")
        else:
            print("No serp_api_id found for hotel.")

    # Check for Deluxe rooms
    print("\nChecking for Deluxe room prices...")
    logs_res = supabase.table("price_logs") \
        .select("recorded_at, check_in_date, price, room_types") \
        .eq("hotel_id", hid) \
        .order("recorded_at", desc=True) \
        .limit(20) \
        .execute()
    
    for log in logs_res.data:
        r_types = log.get("room_types") or []
        deluxe_rooms = [r for r in r_types if "deluxe" in (r.get("name") or "").lower() or "superior" in (r.get("name") or "").lower()]
        if deluxe_rooms:
            print(f"Found Deluxe in log {log['recorded_at']} (Check-in: {log['check_in_date']}):")
            for dr in deluxe_rooms:
                print(f"  - {dr['name']}: {dr['price']}")
        else:
            # Print all room types to see what's there
            print(f"No Deluxe in log {log['recorded_at']} (Check-in: {log['check_in_date']}). Room types: {[r.get('name') for r in r_types]}")

if __name__ == "__main__":
    asyncio.run(diag())
