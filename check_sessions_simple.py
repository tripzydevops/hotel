
import httpx
import os
from datetime import datetime
import json

async def check_recent_scans():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing Supabase credentials")
        return

    async with httpx.AsyncClient() as client:
        # Query scan_sessions for 2026-02-27
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        
        # Look for 2026-02-27
        resp = await client.get(
            f"{url}/rest/v1/scan_sessions?created_at=gte.2026-02-27T00:00:00Z&order=created_at.desc",
            headers=headers
        )
        
        if resp.status_code != 200:
            print(f"Error: {resp.status_code} {resp.text}")
            return
            
        sessions = resp.json()
        print(f"Found {len(sessions)} sessions since midnight.")
        print(f"{'Created At':<25} | {'Type':<12} | {'Status':<10}")
        print("-" * 50)
        for s in sessions:
            print(f"{s.get('created_at'):<25} | {s.get('session_type'):<12} | {s.get('status'):<10}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(check_recent_scans())
