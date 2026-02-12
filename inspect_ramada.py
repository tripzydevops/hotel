
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client



load_dotenv(".env.local")

# Debug
print(f"Loading .env.local...")
if os.path.exists(".env.local"):
    print(".env.local file found")
else:
    print(".env.local file NOT found")


url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


if not url or not key:
    print("Error: Supabase credentials not found in env")
    exit(1)

supabase: Client = create_client(url, key)

async def check_ramada():
    print("--- Searching for Ramada ---")
    # 1. Find the hotel
    res = supabase.table("hotels").select("*").ilike("name", "%Ramada%").execute()
    
    if not res.data:
        print("No hotel found matching 'Ramada'")
        return

    for hotel in res.data:
        print(f"\nID: {hotel['id']}")
        print(f"Name: {hotel['name']}")
        print(f"Location: {hotel['location']}")
        print(f"SerpApi ID: {hotel.get('serp_api_id')}")
        print(f"Metadata: {hotel.get('metadata')}") # Might contain the wrong image/name
        
        # 2. Check latest price logs
        print(f"--- Latest Logs for {hotel['name']} ---")
        logs = supabase.table("price_logs") \
            .select("*") \
            .eq("hotel_id", hotel['id']) \
            .order("recorded_at", desc=True) \
            .limit(3) \
            .execute()
            
        for log in logs.data:
            print(f"Date: {log['recorded_at']}")
            print(f"Price: {log['price']}")
            # Check if there's competitor data identifying the wrong hotel
            if log.get('competitors'):
                print(f"Competitors count: {len(log['competitors'])}")

if __name__ == "__main__":
    asyncio.run(check_ramada())
