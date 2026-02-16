
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import json

load_dotenv()
load_dotenv(".env.local", override=True)

def debug_1000():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase: Client = create_client(url, key)
    
    # 1. Find the Hotel ID for Hilton
    hotels = supabase.table('hotels').select('id, name').ilike('name', '%Hilton%').execute()
    if not hotels.data:
        print("No Hilton found.")
        return
    
    hotel_id = hotels.data[0]['id']
    print(f"Hilton ID: {hotel_id}")
    
    # 2. Find the specific log entry with price 1000
    # or just recent logs
    print("\n--- Searching for price = 1000 ---")
    res = supabase.table("price_logs") \
        .select("*") \
        .eq("hotel_id", hotel_id) \
        .eq("price", 1000) \
        .execute()
        
    if res.data:
        print(json.dumps(res.data, indent=2, default=str))
    else:
        print("No exact 1000 TL entry found. Showing all recent logs:")
        recent = supabase.table("price_logs") \
            .select("*") \
            .eq("hotel_id", hotel_id) \
            .order("recorded_at", desc=True) \
            .limit(5) \
            .execute()
        print(json.dumps(recent.data, indent=2, default=str))

if __name__ == "__main__":
    debug_1000()
