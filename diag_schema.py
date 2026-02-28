
import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def check_schema():
    # We can't easily get full schema via Supabase-py without direct SQL
    # But we can check one row and see keys
    print("--- Schema Check ---")
    
    tables = ["price_logs", "scan_sessions", "hotels"]
    for table in tables:
        res = supabase.table(table).select("*").limit(1).execute()
        if res.data:
            print(f"\nTable: {table}")
            print(f"Columns: {list(res.data[0].keys())}")
        else:
            print(f"\nTable: {table} (Empty)")

if __name__ == "__main__":
    asyncio.run(check_schema())
