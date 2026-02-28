
import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")
from uuid import UUID
from backend.services.monitor_service import run_monitor_background
from backend.utils.db import get_supabase

async def force_scan():
    print("--- Starting Force Scan with Telemetry ---")
    try:
        db = get_supabase()
        user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
        
        print(f"Fetching hotels for user {user_id}...")
        hotels_res = db.table("hotels").select("*").eq("user_id", user_id).is_("deleted_at", "null").execute()
        hotels = hotels_res.data or []
        
        if not hotels:
            print("No hotels found to scan. Exiting.")
            return

        # NEW: Create a real scan session so reasoning timeline is visible
        print("Creating scan session...")
        session_res = db.table("scan_sessions").insert({
            "user_id": user_id,
            "session_type": "manual",
            "hotels_count": len(hotels),
            "status": "pending",
            "check_in_date": datetime.now().date().isoformat(),
            "currency": "TRY"
        }).execute()
        
        session_id = session_res.data[0]["id"] if session_res.data else None
        print(f"Session Created: {session_id}")

        if session_id:
             # Initial reasoning trace
             db.table("scan_sessions").update({
                 "reasoning_trace": [f"[Manual Force Scan] Initiated by Antigravity system check. Hotels: {len(hotels)}"]
             }).eq("id", session_id).execute()

        print(f"Starting background monitor for session {session_id}...")
        await run_monitor_background(
            user_id=UUID(user_id),
            hotels=hotels,
            options=None,
            db=db,
            session_id=UUID(session_id) if session_id else None
        )
        print(f"Direct scan complete. Session {session_id} should now have full reasoning.")
        
    except Exception as e:
        print(f"CRITICAL ERROR in force_scan: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(force_scan())
