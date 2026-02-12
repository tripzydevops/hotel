
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found in env")
    exit(1)

supabase: Client = create_client(url, key)

BAD_HOTEL_ID = "8b1b774a-ef15-489b-825f-1ec175b2dd07"
BAD_TOKEN = "ChkI0NXi76z7rL9FGg0vZy8xMWMxOTBwMWo4EAE"

async def fix_ramada():
    print("--- Fixing Ramada Data ---")
    
    # 1. Verify existence
    print(f"Checking Hotel ID: {BAD_HOTEL_ID}")
    res = supabase.table("hotels").select("*").eq("id", BAD_HOTEL_ID).execute()
    
    if not res.data:
        print("Hotel ID not found (already deleted?)")
    else:
        hotel = res.data[0]
        print(f"Found Hotel: {hotel['name']} (Token: {hotel.get('serp_api_id')})")
        
        if hotel.get('serp_api_id') == BAD_TOKEN:
            print("CONFIRMED: Bad token match.")
            # Delete
            print("Deleting hotel...")
            del_res = supabase.table("hotels").delete().eq("id", BAD_HOTEL_ID).execute()
            print("Hotel deleted.")
        else:
            print("WARNING: Token mismatch! Aborting delete to be safe.")

    # 2. Cleanup Directory
    print(f"Cleaning up directory for Token: {BAD_TOKEN}")
    dir_res = supabase.table("hotel_directory").delete().eq("serp_api_id", BAD_TOKEN).execute()
    print(f"Directory entries deleted: {len(dir_res.data)}")

if __name__ == "__main__":
    asyncio.run(fix_ramada())
