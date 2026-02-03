import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load envs
load_dotenv()
load_dotenv(".env.local", override=True)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

async def debug_sessions():
    print("--- Debugging Recent Scan Sessions ---")
    
    # Get last 5 sessions
    response = supabase.table("scan_sessions").select("*").order("created_at", desc=True).limit(5).execute()
    sessions = response.data
    
    if not sessions:
        print("No sessions found.")
        return

    for s in sessions:
        print(f"\nSession ID: {s['id']}")
        print(f"Status: {s['status']}")
        print(f"Created: {s['created_at']}")
        
        # Get logs for this session
        logs_resp = supabase.table("query_logs").select("*").eq("session_id", s['id']).execute()
        logs = logs_resp.data
        
        print(f"Log Count: {len(logs)}")
        if logs:
            for log in logs[:3]: # Show first 3 logs
                print(f" - Hotel: {log.get('hotel_name')} | Status: {log.get('status')} | Price: {log.get('price')} {log.get('currency')} | Provider: {log.get('vendor')}")
        else:
            print(" -> NO LOGS FOUND (Scan might have crashed or haven't started processing)")

if __name__ == "__main__":
    asyncio.run(debug_sessions())
