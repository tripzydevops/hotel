import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timezone, timedelta

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def check_sessions():
    print("--- Recent Scan Sessions ---")
    last_24h = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    res = supabase.table("scan_sessions").select("*").gte("created_at", last_24h).order("created_at", desc=True).limit(20).execute()
    sessions = res.data or []
    
    for s in sessions:
        created = datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
        completed = datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00")) if s.get("completed_at") else None
        duration = (completed - created).total_seconds() * 1000 if completed else "N/A"
        print(f"ID: {s['id']} | Type: {s['session_type']} | Status: {s['status']} | Hotels: {s['hotels_count']} | Duration: {duration} ms")

if __name__ == "__main__":
    asyncio.run(check_sessions())
