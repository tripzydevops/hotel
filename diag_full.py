
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diag_full():
    print("--- Full Diagnostic: Hotels & Catalog ---")
    
    # 1. Fetch all hotels
    h_res = supabase.table("hotels").select("*").execute()
    hotels = h_res.data or []
    print(f"Total Hotels: {len(hotels)}")

    for h in hotels:
        hid = h["id"]
        print(f"\nHotel: {h['name']} (ID: {hid})")
        print(f"  Is Target: {h.get('is_target_hotel')}")
        print(f"  User ID: {h.get('user_id')}")
        
        # Check logs count
        l_res = supabase.table("price_logs").select("count", count="exact").eq("hotel_id", hid).execute()
        print(f"  Price Logs Count: {l_res.count}")
        
        # Check catalog
        c_res = supabase.table("room_type_catalog").select("original_name, normalized_name").eq("hotel_id", hid).execute()
        if c_res.data:
            print(f"  Catalog Entries: {len(c_res.data)}")
            for entry in c_res.data[:3]:
                print(f"    - {entry['original_name']} -> {entry['normalized_name']}")
        else:
            print("  No Catalog Entries")

if __name__ == "__main__":
    asyncio.run(diag_full())
