# ruff: noqa
import asyncio
import os
import sys
from dotenv import load_dotenv # type: ignore

# Add root to path
sys.path.append(os.getcwd())
load_dotenv(os.path.join(os.getcwd(), '.env.local'))
load_dotenv(os.path.join(os.getcwd(), '.env'))

from backend.utils.db import get_supabase # type: ignore

async def check_guest_mentions():
    db = get_supabase()
    if not db:
        print("Error: Could not connect to Supabase.")
        return

    print("--- Checking Guest Mentions Data ---")
    try:
        res = db.table("hotels").select("id, name, guest_mentions").not_.is_("guest_mentions", "null").execute()
        hotels = res.data or []
        print(f"Hotels with guest_mentions: {len(hotels)}")
        for h in hotels:
            mentions = h.get('guest_mentions') or []
            if mentions:
                print(f"  - {h['name']}: {mentions[:2]}")
    except Exception as e:
        print(f"Error checking guest_mentions: {e}")

if __name__ == "__main__":
    asyncio.run(check_guest_mentions())
