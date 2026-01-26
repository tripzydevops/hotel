
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
    print("Error: Supabase credentials missing.")
    sys.exit(1)

supabase = create_client(url, key)

def delete_user(search_term):
    print(f"Searching for DELETE target matching: '{search_term}'...")
    
    # Search in user_profiles
    res = supabase.table("user_profiles").select("*").ilike("display_name", f"%{search_term}%").execute()
    users = res.data
    
    if not users:
        print("No users found to delete.")
        return

    target_user = None
    if len(users) == 1:
        target_user = users[0]
    else:
        print(f"Found {len(users)} matches. Please be specific.")
        for u in users:
            print(f" - {u['display_name']} ({u['user_id']})")
            if u['display_name'] == "Demo User":
                target_user = u
        
        if not target_user:
            return

    print(f"FOUND TARGET: {target_user['display_name']} ({target_user['user_id']})")
    
    confirm = input(f"PERMANENTLY DELETE {target_user['display_name']}? (y/n): ")
    if confirm.lower() == 'y':
        # 1. Delete from user_profiles (Cascade should handle relations, but manual cleanup checks good)
        supabase.table("user_profiles").delete().eq("user_id", target_user['user_id']).execute()
        
        # 2. Delete from Auth Users (Admin API required)
        try:
            print("Attempting to delete from Supabase Auth...")
            supabase.auth.admin.delete_user(target_user['user_id'])
            print("Auth deletion successful.")
        except Exception as e:
            print(f"Auth deletion warning (might need manual cleanup): {e}")

        print("Success! User deleted.")
    else:
        print("Cancelled.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Default deletion target if none provided, safety first
        # delete_user("Demo User") 
        print("Usage: python delete_user.py <name_fragment>")
    else:
        delete_user(sys.argv[1])
