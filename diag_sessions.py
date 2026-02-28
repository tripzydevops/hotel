
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def check_sessions():
    db = get_supabase()
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    
    print(f"--- Recent Scan Sessions for {user_id} ---")
    res = db.table("scan_sessions").select("id, status, created_at, session_type, reasoning_trace").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    
    for s in res.data:
        trace = s.get("reasoning_trace") or []
        print(f"Session: {s['id']}")
        print(f"  Type:   {s['session_type']}")
        print(f"  Status: {s['status']}")
        print(f"  Created:{s['created_at']}")
        print(f"  Trace Len: {len(trace)}")
        if trace:
            print(f"  First item: {trace[0] if isinstance(trace[0], str) else trace[0].get('message')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_sessions())
