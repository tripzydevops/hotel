import os
import asyncio
from supabase import create_client
from dotenv import load_dotenv

# Load env from root directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))

async def check_db():
    url = "https://ocjpxvjyxmzmxyxvjxzp.supabase.co"
    key = "..." # I should have this in env, but for this check I'll assume it works if I set it in run_command
    # Actually I'll use the env vars
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("Missing env vars")
        return
        
    supabase = create_client(url, key)

    # 1. Get Willmont Hotel updates
    res = supabase.table('hotels').select('id, name').ilike('name', '%Willmont%').execute()
    if res.data:
        hid = res.data[0]['id']
        logs = supabase.table('price_logs').select('recorded_at, price').eq('hotel_id', hid).order('recorded_at', desc=True).limit(5).execute()
        print(f'\n--- Price Logs for Willmont ({hid}) ---')
        for l in logs.data:
            print(f"{l['recorded_at']} -> {l['price']}")
    else:
        print("\nWillmont Hotel not found.")

    # 2. Check for recent scheduled sessions
    sessions = supabase.table('scan_sessions').select('*').eq('session_type', 'scheduled').order('created_at', desc=True).limit(5).execute()
    print('\n--- Recent Scheduled Sessions ---')
    if not sessions.data:
        print('No scheduled sessions found.')
    else:
        for s in sessions.data:
            print(f"{s['id']} | Status: {s['status']} | Created: {s['created_at']}")

    # 3. Check recent manual sessions too
    manuals = supabase.table('scan_sessions').select('*').eq('session_type', 'manual').order('created_at', desc=True).limit(5).execute()
    print('\n--- Recent Manual Sessions ---')
    for m in manuals.data:
        print(f"{m['id']} | Status: {m['status']} | Created: {m['created_at']}")

if __name__ == "__main__":
    asyncio.run(check_db())
