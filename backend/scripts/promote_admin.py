
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load vars
load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials (URL/SERVICE_ROLE_KEY) missing.")
    sys.exit(1)

supabase = create_client(url, key)

def promote_user(search_term):
    print(f"Searching for user matching: '{search_term}'...")
    
    # 1. Search in user_profiles
    # We can't search auth.users easily via client lib in some versions, but we can check profiles
    res = supabase.table("user_profiles").select("*").ilike("display_name", f"%{search_term}%").execute()
    
    users = res.data
    
    if not users:
        # Try searching by exact user_id if it looks like a UUID? 
        # Or maybe listing all and filtering (slow but ok for script)
        all_res = supabase.table("user_profiles").select("*").execute()
        # manual filter if needed?
        print("No users found by display_name match. Listing all for manual selection:")
        for u in all_res.data:
            print(f" - {u['display_name']} ({u['user_id']}) Role: {u.get('role')}")
        return

    target_user = None
    if len(users) == 1:
        target_user = users[0]
    else:
        print(f"Found {len(users)} matches. Please be more specific.")
        for u in users:
            print(f" - {u['display_name']} ({u['user_id']})")
        return

    print(f"Found User: {target_user['display_name']}")
    print(f"Current Role: {target_user.get('role')}")
    
    if target_user.get('role') == 'admin':
        print("User is already admin.")
        return

    confirm = input(f"Promote {target_user['display_name']} to ADMIN? (y/n): ")
    if confirm.lower() == 'y':
        supabase.table("user_profiles").update({"role": "admin"}).eq("user_id", target_user['user_id']).execute()
        print("Success! User is now an Admin.")
    else:
        print("Cancelled.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_admin.py <display_name_fragment>")
        # Default scan
        promote_user("tripzy")
    else:
        promote_user(sys.argv[1])
