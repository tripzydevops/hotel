import os
import sys
import asyncio
import json

# Standard imports with type ignore to satisfy IDEs that don't see the environment
try:
    from dotenv import load_dotenv  # type: ignore
    from supabase import create_client  # type: ignore
except ImportError:
    pass

# Ensure backend items are discoverable if run from root
sys.path.append(os.path.join(os.getcwd(), "backend"))

load_dotenv(".env.local", override=True)

async def check_recent_offers():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing Supabase credentials in .env.local")
        return

    db = create_client(url, key)
    
    print("Fetching last 10 price_logs...")
    try:
        res = db.table("price_logs") \
            .select("id, hotel_id, price, parity_offers, room_types, recorded_at") \
            .order("recorded_at", desc=True) \
            .limit(10) \
            .execute()
        
        if not res.data:
            print("No price logs found.")
            return

        for i, entry in enumerate(res.data):
            offers = entry.get("parity_offers") or []
            rooms = entry.get("room_types") or []
            print(f"[{i+1}] ID: {entry['id']} | Hotel ID: {entry['hotel_id']} | Price: {entry['price']}")
            print(f"    Recorded At: {entry['recorded_at']}")
            print(f"    Parity Offers: {len(offers)} found")
            if offers:
                print(f"    Sample Offer: {offers[0].get('vendor')} - {offers[0].get('price')}")
            print(f"    Room Types: {len(rooms)} found")
            print("-" * 40)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_recent_offers())
