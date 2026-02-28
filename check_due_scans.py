
import asyncio
import os
import sys
from datetime import datetime
from uuid import UUID

# Add backend to path
sys.path.append(os.getcwd())

from backend.services.supabase_client import get_supabase

async def check_scans():
    supabase = get_supabase()
    
    # Get all profiles with next_scan_at
    response = supabase.table("profiles").select("id, email, next_scan_at").execute()
    profiles = response.data
    
    print(f"{'Email':<30} | {'Next Scan At':<25} | {'Status'}")
    print("-" * 70)
    
    now = datetime.utcnow()
    
    for p in profiles:
        nsa = p.get('next_scan_at')
        if not nsa:
            continue
            
        nsa_dt = datetime.fromisoformat(nsa.replace('Z', '+00:00')).replace(tzinfo=None)
        
        status = "DUE" if nsa_dt < now else "FUTURE"
        print(f"{p.get('email', 'N/A'):<30} | {nsa:<25} | {status}")

if __name__ == "__main__":
    asyncio.run(check_scans())
