
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def check_user_data(user_id):
    db = get_supabase()
    print(f"Checking data for user {user_id}...")
    
    # 1. Check Hotels
    hotels = db.table("hotels").select("*").eq("user_id", user_id).is_("deleted_at", "null").execute()
    print(f"Hotels found: {len(hotels.data)}")
    for h in hotels.data:
        print(f"  - {h['name']} ({h['id']})")
    
    if not hotels.data:
        return

    # 2. Check Price Logs
    hids = [str(h["id"]) for h in hotels.data]
    logs = db.table("price_logs").select("*").in_("hotel_id", hids).order("recorded_at", desc=True).limit(5).execute()
    print(f"\nPrice Logs found: {len(logs.data)}")
    for l in logs.data:
        print(f"  - Hotel: {l['hotel_id']}, Match: {l['serp_api_id']}, Date: {l['recorded_at']}, Price: {l['price']} {l['currency']}")

if __name__ == "__main__":
    import sys
    uid = sys.argv[1] if len(sys.argv) > 1 else "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    asyncio.run(check_user_data(uid))
