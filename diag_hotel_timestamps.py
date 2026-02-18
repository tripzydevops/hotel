
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diag_timestamps():
    print("--- Hotel Timestamps ---")
    res = supabase.table("hotels").select("*").execute()
    for h in res.data:
        print(f"Name: {h['name']}")
        print(f"  ID: {h['id']}")
        print(f"  Target: {h.get('is_target_hotel')}")
        print(f"  Created At: {h.get('created_at')}")
        # print(f"  Updated At: {h.get('updated_at')}") # Check if this exists
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(diag_timestamps())
