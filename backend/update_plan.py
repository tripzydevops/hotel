
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Force reload if needed
load_dotenv(".env.local")
load_dotenv(".env")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found.")
    exit(1)

supabase: Client = create_client(url, key)

async def update_plan():
    email = "tripzydevops@gmail.com"
    new_plan = "enterprise"
    
    print(f"--- Updating '{email}' to '{new_plan}' ---")
    
    try:
        # 1. Get User ID
        res = supabase.table("user_profiles").select("user_id").eq("email", email).execute()
        if not res.data:
            print(f"User {email} not found.")
            return

        user_id = res.data[0]['user_id']
        print(f"Found User ID: {user_id}")
        
        # 2. Update Plan
        update_res = supabase.table("user_profiles").update({"plan_type": new_plan}).eq("user_id", user_id).execute()
        
        if update_res.data:
            print(f"Success! Updated plan to: {update_res.data[0].get('plan_type')}")
        else:
            print("Update failed or no change needed.")

    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    asyncio.run(update_plan())
