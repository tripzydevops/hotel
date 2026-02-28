
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

async def inspect_schema():
    load_dotenv(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    
    # 1. Inspect user_profiles
    print("\n--- user_profiles schema ---")
    res = supabase.table("user_profiles").select("*").limit(1).execute()
    if res.data:
        print(list(res.data[0].keys()))
    else:
        print("No user_profiles data.")
        
    # 2. Check for a dedicated sub/tiers table
    print("\n--- Checking for tiers/plans table ---")
    try:
        res = supabase.table("membership_tiers").select("*").limit(1).execute()
        print("membership_tiers exists:", list(res.data[0].keys()) if res.data else "Empty")
    except:
        print("membership_tiers does not exist.")

if __name__ == "__main__":
    asyncio.run(inspect_schema())
