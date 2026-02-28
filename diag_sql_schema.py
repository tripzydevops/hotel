
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

async def check_cols():
    load_dotenv(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    try:
        res = supabase.table("membership_plans").select("*").limit(1).execute()
        if res.data:
            print("Existing columns in membership_plans:", list(res.data[0].keys()))
        else:
            print("membership_plans table is empty or schema unknown.")
    except Exception as e:
        print(f"Error checking table: {e}")

if __name__ == "__main__":
    asyncio.run(check_cols())
