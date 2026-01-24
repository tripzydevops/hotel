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
    
    print("Fetching pending sessions...")
    # Fetch pending sessions likely created by the bug (check 'scheduled' if type exists, or just pending)
    # Based on previous code, type might be 'manual' or 'scheduled' if logic existed.
    # The user screenshot showed "SCHEDULED" in session type.
    
    try:
        # Delete pending scheduled sessions
        res = db.table("scan_sessions").delete().eq("status", "pending").eq("session_type", "scheduled").execute()
        
        # Also clean up 'completed' ones if they are empty/bugged? No, user just asked to clear "them" (the pending ones).
        
        count = len(res.data) if res.data else 0
        print(f"Successfully deleted {count} pending scheduled sessions.")
        
    except Exception as e:
        print(f"Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup()
