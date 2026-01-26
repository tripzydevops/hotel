
import os
import sys
import asyncio
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

# Load Env
load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

async def test_admin_check():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("MISSING SUPABASE SERVICE ROLE KEY OR URL")
        return

    print(f"Connecting to {url} with Service Role Key...")
    db = create_client(url, key)

    try:
        # 1. Fetch 'elif@tripzy.travel' UID to simulate
        print("\n--- FINDING USER 'tripzydevops@gmail.com' (Assumption) ---")
        # Admin listing is only possible via settings or raw query if we have permissions
        # We try to list users (GoTrue)
        try:
            users_page = db.auth.admin.list_users()
            print(f"Found {len(users_page)} users in Auth.")
            
            target_user = None
            for u in users_page:
                if "tripzy" in u.email or "admin" in u.email:
                    print(f"Found Potential Admin: {u.email} ({u.id})")
                    target_user = u
                    break
            
            if not target_user:
                print("No admin-like user found in list.")
                return

            print(f"\n--- SIMULATING AUTH CHECK for {target_user.email} ---")
            
            # Check Whitelist
            email = target_user.email
            print(f"Checking Whitelist for {email}...")
            if email and (email in ["admin@hotel.plus", "elif@tripzy.travel"] or email.endswith("@tripzy.travel")):
                print("[PASS] Whitelist")
            else:
                print("[FAIL] Whitelist")

            # Check DB Profile
            print(f"Checking DB Profile context for {target_user.id}...")
            profile = db.table("user_profiles").select("role").eq("user_id", target_user.id).limit(1).execute()
            if profile.data:
                role = profile.data[0].get('role')
                print(f"DB Role: {role}")
                if role == 'admin':
                    print("[PASS] DB Role")
                else:
                    print("[FAIL] DB Role")
            else:
                print("[FAIL] DB Profile MISSING")

        except Exception as e:
            print(f"Auth Admin API Error: {e}")

    except Exception as e:
        print(f"General Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_admin_check())
