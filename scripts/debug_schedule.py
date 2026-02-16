
import json
from backend.utils.db import get_supabase
from datetime import datetime

def debug_schedule():
    db = get_supabase()
    
    # Fetch all profiles to find the user (we'll filter manually or just print all if few)
    # or better, fetch the specific user if we know the ID from previous logs: 
    # "eb284dd9-7198-47be-acd0-fdb0403bcd0a" (from previous detailed log output)
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    
    print(f"--- DEBUG SCHEDULE for {user_id} ---")
    
    # 1. Check Profile (Driver of the Cron)
    profile = db.table("profiles").select("*").eq("id", user_id).execute()
    print("--- PROFILE ---")
    print(json.dumps(profile.data, indent=2, default=str))
    
    # 2. Check Recent Sessions (What actually happened)
    sessions = db.table("scan_sessions").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    print("\n--- RECENT SESSIONS ---")
    print(json.dumps(sessions.data, indent=2, default=str))

if __name__ == "__main__":
    debug_schedule()
