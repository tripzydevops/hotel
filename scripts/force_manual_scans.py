import asyncio
import os
import sys
from uuid import UUID
from dotenv import load_dotenv
from supabase import create_client, Client

# Add project root to path
# Assuming script is in /home/tripzydevops/hotel/scripts
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# Load environment
# Checking for .env.local first as it usually contains development/VM overrides
env_path = os.path.join(project_root, ".env.local")
if not os.path.exists(env_path):
    env_path = os.path.join(project_root, ".env")

load_dotenv(env_path)
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("ERROR: Supabase URL or Service Role Key not found in environment.")
    sys.exit(1)

db: Client = create_client(url, key)

from backend.services.monitor_service import run_monitor_background

async def force_scans():
    print(f"--- Force Manual Scans (Env: {os.path.basename(env_path)}) ---")
    
    # 1. Fetch Active Profiles
    # We target users who are 'active' or in 'trial'
    try:
        profiles_res = db.table("profiles").select("id").in_("subscription_status", ["active", "trial"]).execute()
        profiles = profiles_res.data or []
        print(f"Found {len(profiles)} active users.")
    except Exception as e:
        print(f"ERROR: Failed to fetch profiles: {e}")
        return

    for p in profiles:
        user_id = p["id"]
        print(f"\n[USER] Processing {user_id}")
        
        # 2. Get Hotels for this user
        try:
            hotels_res = db.table("hotels").select("*").eq("user_id", user_id).is_("deleted_at", "null").execute()
            hotels = hotels_res.data or []
        except Exception as e:
            print(f"  - ERROR: Failed to fetch hotels for user {user_id}: {e}")
            continue
        
        if not hotels:
            print(f"  - No active hotels found. Skipping.")
            continue
            
        print(f"  - Triggering scan for {len(hotels)} hotels...")
        
        # 3. Create Session (Essential for progress tracking in UI)
        session_id = None
        try:
            session_result = (
                db.table("scan_sessions")
                .insert({
                    "user_id": user_id,
                    "session_type": "manual",
                    "hotels_count": len(hotels),
                    "status": "pending",
                    "created_at": datetime.now().isoformat()
                })
                .execute()
            )
            if session_result.data:
                session_id = session_result.data[0]["id"]
                print(f"  - Created Session: {session_id}")
        except Exception as e:
            # Fallback for session creation failure
            print(f"  - Session creation failed (continuing without session ID): {e}")

        # 4. Run Scan Pipeline
        try:
            from datetime import datetime
            print(f"  - Starting monitor background task...")
            # We call the background task directly. 
            # Note: This runs IN-PROCESS in this script.
            await run_monitor_background(
                user_id=UUID(user_id),
                hotels=hotels,
                options=None,
                db=db,
                session_id=UUID(session_id) if session_id else None
            )
            print(f"  - Scan sequence finished for user {user_id}.")
        except Exception as e:
            print(f"  - Scan execution failed: {e}")

if __name__ == "__main__":
    from datetime import datetime
    asyncio.run(force_scans())
