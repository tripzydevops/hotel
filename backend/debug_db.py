import asyncio
import os
import sys
from dotenv import load_dotenv

# Add root to path
sys.path.append(os.getcwd())
# Load .env.local for Next.js/Supabase env vars
load_dotenv(os.path.join(os.getcwd(), '.env.local'))
load_dotenv(os.path.join(os.getcwd(), '.env'))

from backend.main import get_supabase

async def check_db():
    print("Connecting to Supabase...")
    db = get_supabase()
    
    # 1. Fetch all hotels
    print("\n--- FETCHING ALL HOTELS ---")
    hotels = db.table("hotels").select("*").execute()
    
    user_counts = {}
    
    if not hotels.data:
        print("No hotels found in DB.")
    else:
        print(f"Found {len(hotels.data)} hotels total.")
        for hotel in hotels.data:
            uid = hotel['user_id']
            user_counts[uid] = user_counts.get(uid, 0) + 1
            print(f"- [{hotel['id']}] {hotel['name']} ({hotel['location']})")
            print(f"  User: {uid} | Target: {hotel['is_target_hotel']} | SerpID: {hotel.get('serp_api_id')}")
            
            # Fetch Price Logs for this hotel
            prices = db.table("price_logs").select("*").eq("hotel_id", hotel['id']).order("recorded_at", desc=True).limit(1).execute()
            if prices.data:
                latest = prices.data[0]
                print(f"  > Latest Price: {latest['price']} {latest['currency']} from {latest.get('source')} (Vendor: {latest.get('vendor')})")
            else:
                print("  > No price logs found.")
    
    print("\n--- USER STATS --")
    for uid, count in user_counts.items():
        print(f"User {uid}: {count} hotels")

if __name__ == "__main__":
    asyncio.run(check_db())
