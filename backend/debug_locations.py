
import os
import asyncio
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())

# Load envs
load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

async def debug_locations():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("❌ Supabase credentials missing!")
        return

    db = create_client(url, key)
    
    try:
        # 1. Check current registry
        print("Checking location_registry table...")
        res = db.table("location_registry").select("*").execute()
        locations = res.data or []
        print(f"Found {len(locations)} locations in registry.")
        for loc in locations[:10]:
            print(f" - {loc.get('country')} / {loc.get('city')}")

        # 2. Check source hotels
        print("\nChecking hotels table for distinct locations...")
        # Note: distinct on a column isn't directly supported by simple select without RPC usually,
        # but we can fetch all and process in python for debug.
        res_hotels = db.table("hotels").select("location").execute()
        hotels = res_hotels.data or []
        print(f"Found {len(hotels)} hotels with location data.")
        
        unique_locs = set()
        for h in hotels:
            if h.get("location"):
                 unique_locs.add(h["location"])
        
        print(f"Unique location strings in hotels table: {len(unique_locs)}")
        for l in list(unique_locs)[:10]:
            print(f" - {l}")

        # 3. Suggest Seeding
        if len(locations) < len(unique_locs) and len(unique_locs) > 0:
            print("\nWARNING: Registry seems under-populated compared to hotels.")
            print("To fix, we might need to parse these location strings and insert them.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_locations())
