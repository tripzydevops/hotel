
import os
import asyncio
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
load_dotenv(".env.local", override=True)

async def verify_queue_logic():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ Supabase credentials missing")
        return

    db = create_client(url, key)
    
    print("--- Verifying Settings Update Logic ---")
    test_user_id = "00000000-0000-0000-0000-000000000000" # Placeholder or a real one if found
    # Try to find a real user
    users = db.table("user_profiles").select("user_id").limit(1).execute()
    if users.data:
        test_user_id = users.data[0]["user_id"]
        print(f"Using test user: {test_user_id}")
    
    # Test updating frequency to 720 (12h)
    print(f"Updating frequency to 720 for {test_user_id}...")
    res = db.table("settings").upsert({
        "user_id": test_user_id,
        "check_frequency_minutes": 720,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    
    if res.data:
        print(f"✅ Frequency updated: {res.data[0]['check_frequency_minutes']}")
    else:
        print("❌ Failed to update frequency")

    print("\n--- Verifying Scheduler Queue Logic ---")
    # Fetch all users with frequencies > 0
    settings_res = db.table("settings").select("user_id, check_frequency_minutes").gt("check_frequency_minutes", 0).execute()
    user_settings = settings_res.data or []
    print(f"Found {len(user_settings)} users with scheduled scans")
    
    for s in user_settings:
        uid = s["user_id"]
        freq = s["check_frequency_minutes"]
        
        # Get profile
        p_res = db.table("user_profiles").select("display_name").eq("user_id", uid).execute()
        name = p_res.data[0]["display_name"] if p_res.data else "Unknown"
        
        # Get latest session
        sessions_res = db.table("scan_sessions") \
            .select("created_at, status") \
            .eq("user_id", uid) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
            
        last_session = sessions_res.data[0] if sessions_res.data else None
        
        last_scan_at = None
        next_scan_at = None
        status = "pending"
        
        now = datetime.now(timezone.utc)
        if last_session:
            last_scan_at = datetime.fromisoformat(last_session["created_at"].replace("Z", "+00:00"))
            next_scan_at = last_scan_at + timedelta(minutes=freq)
            
            if last_session["status"] in ["processing", "queued", "running"]:
                status = "running"
            elif next_scan_at < now:
                status = "overdue"
        else:
            next_scan_at = now
            status = "pending"
            
        print(f"User: {name} ({uid})")
        print(f"  Freq: {freq}min")
        print(f"  Last Scan: {last_scan_at}")
        print(f"  Next Scan: {next_scan_at}")
        print(f"  Status: {status}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(verify_queue_logic())
