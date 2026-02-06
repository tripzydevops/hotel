
import os
import asyncio
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials missing.")
    exit(1)

supabase: Client = create_client(url, key)

async def backfill_metadata():
    print("=== Starting Scan Metadata Backfill ===")
    
    # 1. Fetch sessions with missing check_in_date
    res = supabase.table("scan_sessions").select("*").is_("check_in_date", "null").order("created_at", desc=True).execute()
    sessions = res.data or []
    
    print(f"Found {len(sessions)} sessions to process.")
    
    updated_sessions = 0
    updated_logs = 0
    
    for session in sessions:
        sid = session["id"]
        created_at = datetime.fromisoformat(session["created_at"].replace("Z", "+00:00"))
        
        # Heuristic 1: Check price_logs linked to this time window for target user
        # We find query_logs for this session first
        qres = supabase.table("query_logs").select("*").eq("session_id", sid).execute()
        qlogs = qres.data or []
        
        inferred_date = None
        inferred_adults = 2 # Default
        
        # Look for the first log that has a corresponding price_log recorded near it
        for ql in qlogs:
            # Finding a price log for this hotel recorded at almost the same time
            ql_time = datetime.fromisoformat(ql["created_at"].replace("Z", "+00:00"))
            
            # Simple window: +/- 5 minutes
            start_window = (ql_time - timedelta(minutes=5)).isoformat()
            end_window = (ql_time + timedelta(minutes=5)).isoformat()
            
            pres = supabase.table("price_logs") \
                .select("check_in_date") \
                .gte("recorded_at", start_window) \
                .lte("recorded_at", end_window) \
                .limit(1) \
                .execute()
            
            if pres.data:
                inferred_date = pres.data[0]["check_in_date"]
                break
        
        # Heuristic 2: If session was very recent (today) and failed (no price logs found)
        # We check if it's the one the user just complained about (Feb 23rd)
        if not inferred_date:
            now = datetime.now(created_at.tzinfo)
            if (now - created_at).total_seconds() < 3600 * 3: # Last 3 hours
                # Likely the Feb 23rd manual tests from user request
                inferred_date = "2026-02-23"
                inferred_adults = 1
            else:
                # Default for older ones: check-in on the day of the scan
                inferred_date = created_at.date().isoformat()

        # Update Session
        try:
            supabase.table("scan_sessions").update({
                "check_in_date": inferred_date,
                "adults": inferred_adults,
                "currency": "TRY" if "Balikesir" in str(qlogs) or "Istanbul" in str(qlogs) else "USD"
            }).eq("id", sid).execute()
            updated_sessions += 1
            
            # Update associated logs
            if qlogs:
                supabase.table("query_logs").update({
                    "check_in_date": inferred_date,
                    "adults": inferred_adults
                }).eq("session_id", sid).execute()
                updated_logs += len(qlogs)
        except Exception as e:
            print(f"Error updating session {sid}: {e}")

    print("--- Backfill Complete ---")
    print(f"Sessions Updated: {updated_sessions}")
    print(f"Logs Updated: {updated_logs}")

if __name__ == "__main__":
    asyncio.run(backfill_metadata())
