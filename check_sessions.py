
import asyncio
import os
import sys
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.getcwd())

from backend.services.supabase_client import get_supabase

async def check_sessions():
    supabase = get_supabase()
    
    # Check sessions created in the last 24 hours
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    
    response = supabase.table("scan_sessions").select("*").gt("created_at", since).order("created_at", descending=True).execute()
    sessions = response.data
    
    print(f"{'Created At':<25} | {'Type':<12} | {'Status':<10} | {'Hotels'}")
    print("-" * 70)
    
    for s in sessions:
        print(f"{s.get('created_at', 'N/A'):<25} | {s.get('session_type', 'N/A'):<12} | {s.get('status', 'N/A'):<10} | {s.get('hotels_count', 0)}")

if __name__ == "__main__":
    asyncio.run(check_sessions())
