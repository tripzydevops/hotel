import os
import asyncio
from supabase import create_client

def load_env_local():
    # Use absolute path or relative to project root
    root = os.getcwd()
    env_path = os.path.join(root, ".env.local")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    # Handle possible quotes
                    key, value = line.split("=", 1)
                    value = value.strip().strip('"').strip("'")
                    os.environ[key] = value

async def find_unknown_users():
    load_env_local()
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print(f"Missing env vars. URL: {url}, KEY: {'SET' if key else 'MISSING'}")
        return
    supabase = create_client(url, key)

    # 1. Get users from settings with frequency > 0
    settings = supabase.table('settings').select('user_id, check_frequency_minutes').gt('check_frequency_minutes', 0).execute()
    user_ids = [s['user_id'] for s in settings.data]
    
    # 2. Get profile names
    profiles = supabase.table('user_profiles').select('user_id, display_name').in_('user_id', user_ids).execute()
    profile_uids = [p['user_id'] for p in profiles.data]
    
    # 3. Identify missing profiles
    missing = [uid for uid in user_ids if uid not in profile_uids]
    
    print("\n--- Diagnostic Report ---")
    print(f"Total users in scheduler settings: {len(user_ids)}")
    print(f"Users with profiles found: {len(profile_uids)}")
    print(f"Users WITHOUT profiles (labeled 'Unknown'): {len(missing)}")
    
    if missing:
        print("\n--- Unknown User Details ---")
        for uid in missing:
            # Try to find hotels to identify who this might be
            hotels = supabase.table('hotels').select('name').eq('user_id', uid).execute()
            hotel_names = [h['name'] for h in hotels.data]
            
            # Check for any scan history to see if there's an email in logs or something
            print(f"User ID: {uid}")
            print(f"  Hotels: {len(hotel_names)} | Samples: {', '.join(hotel_names[:5])}")
            print("-" * 30)

if __name__ == "__main__":
    asyncio.run(find_unknown_users())
