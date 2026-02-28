import os
import sys
import asyncio
from datetime import datetime, timezone

print("DEBUG: Script started")
print(f"DEBUG: CWD: {os.getcwd()}")
print(f"DEBUG: PYTHONPATH: {sys.path}")

# Ensure backend module is resolvable
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase

async def check_db():
    print("DEBUG: Inside check_db")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    print(f"DEBUG: URL found: {url}")
    
    sb = get_supabase()
    if not sb:
        print("ERROR: Supabase client is None")
        return

    try:
        # Check profiles
        print("DEBUG: Querying profiles...")
        res_p = sb.table('profiles').select('id, next_scan_at, subscription_status').execute()
        print("\nPROFILES:")
        for r in res_p.data:
            print(f"ID: {r.get('id')}, Next: {r.get('next_scan_at')}, Status: {r.get('subscription_status')}")

        # Check user_profiles (if it exists)
        try:
            print("DEBUG: Querying user_profiles...")
            res_up = sb.table('user_profiles').select('id, next_scan_at').execute()
            print("\nUSER_PROFILES:")
            for r in res_up.data:
                print(f"ID: {r.get('id')}, Next: {r.get('next_scan_at')}")
        except Exception as e:
            print(f"\nUSER_PROFILES table check failed: {e}")

    except Exception as e:
        print(f"Error during query: {e}")

if __name__ == "__main__":
    print("DEBUG: Calling asyncio.run(check_db())")
    asyncio.run(check_db())
    print("DEBUG: Script finished")
