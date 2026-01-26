
import os
import sys
import asyncio
from dotenv import load_dotenv
from uuid import UUID
from datetime import datetime, timezone
import json

# Add project root to path
sys.path.append(os.getcwd())

# Load Env
load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

def get_supabase():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Missing Supabase Credentials")
        return None
    return create_client(url, key)

async def debug_dashboard():
    db = get_supabase()
    if not db:
        print("Failed to initialize DB client")
        return

    print("Fetching ALL user IDs...")
    try:
        # Get ALL users who have hotels
        res = db.table("hotels").select("user_id").execute()
        if not res.data:
            print("No users with hotels found.")
            return
        
        # Unique IDs
        user_ids = list(set([row["user_id"] for row in res.data]))
        print(f"Found {len(user_ids)} users to test.")
        
        # --- REPLICATE GET_DASHBOARD LOGIC ---
        from backend.main import get_dashboard
        
        for i, uid_str in enumerate(user_ids):
            print(f"[{i+1}/{len(user_ids)}] Testing User: {uid_str}")
            try:
                user_id = UUID(uid_str)
                # We mock the dependency injection by passing db directly
                response = await get_dashboard(user_id=user_id, db=db)
                print(f"   SUCCESS. Hotels: {len(response.competitors) + (1 if response.target_hotel else 0)}")
            except Exception as e:
                print(f"\n!!! CRASH DETECTED for USER {uid_str} !!!")
                import traceback
                traceback.print_exc()
                # Don't stop, find all bad users
                continue
            
    except Exception as e:
        print(f"Setup Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_dashboard())
