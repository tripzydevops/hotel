import os
import sys
from supabase import create_client
from dotenv import load_dotenv

# Add parent directory to path to allow imports if needed, 
# though we are just using supabase-py directly here.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))

def cleanup():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
        return

    db = create_client(url, key)
    
    from datetime import datetime, timedelta, timezone
    
    # 1. Clear any 'pending' or 'running' sessions older than 1 hour
    timeout_limit = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    try:
        print(f"Cleaning sessions older than: {timeout_limit}")
        # Clear zombie sessions (any type)
        res = db.table("scan_sessions") \
            .update({"status": "failed"}) \
            .in_("status", ["pending", "running"]) \
            .lt("created_at", timeout_limit) \
            .execute()
        
        count = len(res.data) if res.data else 0
        print(f"Marked {count} zombie sessions as failed.")
        
        # 2. Specifically delete pending scheduled sessions if they are stuck
        res_del = db.table("scan_sessions") \
            .delete() \
            .eq("status", "pending") \
            .eq("session_type", "scheduled") \
            .execute()
        
        count_del = len(res_del.data) if res_del.data else 0
        print(f"Deleted {count_del} specific pending scheduled sessions.")
        
    except Exception as e:
        print(f"Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup()
