import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Env vars not set.")
    exit(1)

supabase: Client = create_client(url, key)

async def check_hotel_rooms():
    # Search for the hotel
    name_query = "Altın Otel"
    print(f"Searching for hotel containing '{name_query}'...")
    
    # Get hotel ID first
    hotels = supabase.table("hotels").select("id, name").ilike("name", f"%{name_query}%").execute()
    
    if not hotels.data:
        print("No hotel found.")
        return

    for h in hotels.data:
        print(f"Found Hotel: {h['name']} (ID: {h['id']})")
        
        # Get latest price log
        logs = supabase.table("price_logs") \
            .select("*") \
            .eq("hotel_id", h['id']) \
            .order("recorded_at", desc=True) \
            .limit(1) \
            .execute()
            
        if logs.data:
            log = logs.data[0]
            print(f"  Latest Log ID: {log['id']}")
            print(f"  Price: {log['price']} {log['currency']}")
            print(f"  Room Types (Raw): {log.get('room_types')}")
            print(f"  Room Types Count: {len(log.get('room_types') or [])}")
        else:
            print("  No price logs found.")

if __name__ == "__main__":
    asyncio.run(check_hotel_rooms())
