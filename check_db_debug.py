import os
import sys
import asyncio
from datetime import datetime, timezone

# Ensure backend module is resolvable
sys.path.append('.')

from backend.utils.db import get_supabase

async def check_db():
    print("Checking Supabase...")
    sb = get_supabase()
    if not sb:
        print("ERROR: Supabase client is None")
        return

    try:
        # Check profiles
        res_p = sb.table('profiles').select('id, next_scan_at, subscription_status').execute()
        print("\nPROFILES:")
        for r in res_p.data:
            print(f"ID: {r.get('id')}, Next: {r.get('next_scan_at')}, Status: {r.get('subscription_status')}")

        # Check user_profiles (if it exists)
        try:
            res_up = sb.table('user_profiles').select('id, next_scan_at').execute()
            print("\nUSER_PROFILES:")
            for r in res_up.data:
                print(f"ID: {r.get('id')}, Next: {r.get('next_scan_at')}")
        except Exception as e:
            print(f"\nUSER_PROFILES table check failed: {e}")

        # Check settings
        res_s = sb.table('settings').select('user_id, check_frequency_minutes').execute()
        print("\nSETTINGS:")
        for r in res_s.data:
            print(f"User: {r.get('user_id')}, Freq: {r.get('check_frequency_minutes')}")

    except Exception as e:
        print(f"Error during query: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
