import asyncio
import os
import sys
from datetime import datetime, timezone
import json

# Ensure backend module is resolvable
path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if path not in sys.path:
    sys.path.append(path)

from backend.utils.db import get_supabase

async def check_state():
    db = get_supabase()
    now = datetime.now(timezone.utc)
    print(f"Current UTC Time: {now.isoformat()}")

    # 1. Check Profiles Due for Scan (Deprecated due to removal of next_scan_at)
    print("\n--- Users (Profile Table) ---")
    try:
        res = db.table("profiles").select("id, subscription_status").limit(5).execute()
        if res.data:
            for p in res.data:
                print(f"User: {p['id']} | Status: {p['subscription_status']}")
        else:
            print("No users found.")
    except Exception as e:
        print(f"Error fetching profiles: {e}")

    # 2. Check Recent Sessions for Failures
    print("\n--- Recent Scheduled Sessions ---")
    try:
        res = db.table("scan_sessions").select("id, user_id, status, created_at").eq("session_type", "scheduled").order("created_at", desc=True).limit(5).execute()
        if res.data:
            for s in res.data:
                print(f"ID: {s['id']} | User: {s['user_id']} | Status: {s['status']} | Created: {s['created_at']}")
        else:
            print("No scheduled sessions found.")
    except Exception as e:
        print(f"Error fetching sessions: {e}")

if __name__ == "__main__":
    asyncio.run(check_state())
