
import os
# ruff: noqa
import asyncio
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())

load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

async def inspect_hotels():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    db = create_client(url, key)

    try:
        print("Fetching all hotel locations...")
        res = db.table("hotels").select("id, name, location").execute()
        hotels = res.data or []
        print(f"Total hotels: {len(hotels)}")
        
        print("\n--- Raw Locations ---")
        for h in hotels:
            print(f"[{h['name']}] -> '{h.get('location')}'")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(inspect_hotels())
