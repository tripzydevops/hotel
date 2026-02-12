
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found")
    exit(1)

supabase: Client = create_client(url, key)

CORRECT_TOKEN = "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB"
CLEAN_NAME = "Ramada Residences By Wyndham Balikesir"
CLEAN_LOCATION = "Balikesir, Turkey"

async def cleanup():
    print("--- Cleaning up Ramada Directory Entries ---")
    
    # 1. Delete all existing entries for this token
    print(f"Deleting entries for token: {CORRECT_TOKEN}")
    supabase.table("hotel_directory").delete().eq("serp_api_id", CORRECT_TOKEN).execute()
    
    # 2. Insert one clean entry
    print(f"Inserting clean entry: {CLEAN_NAME} ({CLEAN_LOCATION})")
    data = {
        "name": CLEAN_NAME,
        "location": CLEAN_LOCATION,
        "serp_api_id": CORRECT_TOKEN,
        "last_verified_at": "2026-02-12T10:00:00+00:00"
    }
    res = supabase.table("hotel_directory").insert(data).execute()
    print("Inserted successfully.")

if __name__ == "__main__":
    asyncio.run(cleanup())
