import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

load_dotenv(".env.local", override=True)

from supabase import create_client

def find_admin():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: URLs missing")
        return

    db = create_client(url, key)
    
    print("Searching for admin user...")
    # Try to find by email if possible, or just list users with role=admin
    # Since profiles table usually has config, let's look at user_profiles or just fetch known admin email
    
    # 1. Try generic "admin" role search
    res = db.table("user_profiles").select("*").eq("role", "admin").limit(1).execute()
    if res.data:
        print(f"Found Admin via Role: {res.data[0]}")
        return

    # 2. Just list first 5 users to pick one
    print("Listing available users to pick from:")
    res = db.table("user_profiles").select("user_id, role, first_name").limit(5).execute()
    for u in res.data:
        print(f" - {u}")

if __name__ == "__main__":
    find_admin()
