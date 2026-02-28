
import os
import asyncio
from supabase import create_client

async def check_table():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    tables = ["tier_config", "membership_plans", "tiers"]
    for table in tables:
        try:
            res = supabase.table(table).select("*").limit(1).execute()
            print(f"Table '{table}' exists: {res.data}")
        except Exception:
            print(f"Table '{table}' does not exist.")

if __name__ == "__main__":
    asyncio.run(check_table())
