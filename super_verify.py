
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase
from backend.services.dashboard_service import get_dashboard_logic

async def final_check():
    db = get_supabase()
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    print(f"--- Final Combined Verification for User {user_id} ---")

    # 1. Check Hotels Data
    res = db.table("hotels").select("*").eq("user_id", user_id).is_("deleted_at", "null").execute()
    print(f"Active Hotels: {len(res.data)}")
    for h in res.data:
        print(f"  - {h['name']} | SERP ID: {h.get('serp_api_id')}")

    # 2. Check Latest Price Logs
    print("\n--- Latest Price Logs ---")
    hids = [str(h["id"]) for h in res.data]
    logs = db.table("price_logs").select("*").in_("hotel_id", hids).order("recorded_at", desc=True).limit(10).execute()
    for l in logs.data:
        print(f"  - {l['recorded_at']} | Hotel: {l['hotel_id']} | Price: {l['price']} | Token: {l.get('serp_api_id')}")

    # 3. Check Dashboard Logic
    print("\n--- Dashboard Logic Test ---")
    data = await get_dashboard_logic(user_id, user_id, "test@example.com", db)
    history = data.get("scan_history", [])
    print(f"Dashboard scan_history items: {len(history)}")
    if history:
        print("Latest history item price:", history[0].get("price"))

if __name__ == "__main__":
    asyncio.run(final_check())
