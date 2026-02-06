import os
import asyncio
from supabase import create_client

def load_env_local():
    root = os.getcwd()
    env_path = os.path.join(root, ".env.local")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, value = line.split("=", 1)
                    value = value.strip().strip('"').strip("'")
                    os.environ[key] = value

async def cleanup_legacy_users():
    load_env_local()
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("Missing env vars")
        return
    
    supabase = create_client(url, key)

    # The legacy UIDs we identified
    legacy_uids = [
        "123e4567-e89b-12d3-a456-426614174000",
        "00000000-0000-0000-0000-000000000000"
    ]
    
    print(f"Starting cleanup for {len(legacy_uids)} legacy users...")

    for uid in legacy_uids:
        print(f"\nProcessing User: {uid}")
        
        # 1. Delete Settings (removes from scheduler)
        try:
            res = supabase.table("settings").delete().eq("user_id", uid).execute()
            print(f"  - Deleted Settings: {len(res.data) if res.data else 0} rows")
        except Exception as e:
            print(f"  - Error deleting settings: {e}")

        # 2. Delete Hotels
        try:
            # First delete related logs/alerts for these hotels if cascade isn't perfect
            hotels = supabase.table("hotels").select("id").eq("user_id", uid).execute()
            hotel_ids = [h['id'] for h in hotels.data]
            
            if hotel_ids:
                supabase.table("price_logs").delete().in_("hotel_id", hotel_ids).execute()
                supabase.table("alerts").delete().in_("hotel_id", hotel_ids).execute()
            
            res = supabase.table("hotels").delete().eq("user_id", uid).execute()
            print(f"  - Deleted Hotels: {len(res.data) if res.data else 0} rows")
        except Exception as e:
            print(f"  - Error deleting hotels: {e}")

        # 3. Delete Scan Sessions
        try:
            res = supabase.table("scan_sessions").delete().eq("user_id", uid).execute()
            print(f"  - Deleted Sessions: {len(res.data) if res.data else 0} rows")
        except Exception as e:
            print(f"  - Error deleting sessions: {e}")

    print("\nCleanup Complete.")

if __name__ == "__main__":
    asyncio.run(cleanup_legacy_users())
