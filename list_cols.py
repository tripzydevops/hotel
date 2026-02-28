
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

async def list_columns():
    load_dotenv(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    
    print("Testing hotel_directory columns...")
    res = supabase.table("hotel_directory").select("*").limit(1).execute()
    
    if res.data:
        print("Columns found in a row:")
        print(list(res.data[0].keys()))
    else:
        print("No data in hotel_directory to inspect keys.")

if __name__ == "__main__":
    asyncio.run(list_columns())
