import os
import asyncio
from supabase import create_client

async def check_zombies():
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("Missing env vars")
        return
    supabase = create_client(url, key)

    # Check for pending/running sessions
    res = supabase.table('scan_sessions').select('*').in_('status', ['pending', 'running']).execute()
    print(f"\n--- Found {len(res.data)} Active/Pending Sessions ---")
    for s in res.data:
        print(f"ID: {s['id']} | Status: {s['status']} | Type: {s.get('session_type')} | Created: {s['created_at']}")

if __name__ == "__main__":
    asyncio.run(check_zombies())
