
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

USER_ID = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"

async def test_add():
    hotel_data = {
        "name": "Ramada Residences By Wyndham Balikesir",
        "location": "Balikesir, Turkey",
        "is_target_hotel": True,
        "preferred_currency": "TRY",
        "serp_api_id": "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB"
    }
    
    print(f"--- Testing Add Hotel for User {USER_ID} ---")
    
    try:
        # 1. Insert into hotels
        print("Inserting into 'hotels' table...")
        res = supabase.table("hotels").insert({
            "user_id": USER_ID,
            **hotel_data
        }).execute()
        print("Insert Success!")
        
        # 2. Directory sync (the suspected failure point)
        print("Syncing to 'hotel_directory'...")
        dir_res = supabase.table("hotel_directory").upsert({
            "name": hotel_data["name"],
            "location": hotel_data.get("location"),
            "serp_api_id": hotel_data.get("serp_api_id"),
            "last_verified_at": datetime.now().isoformat()
        }, on_conflict="name,location").execute()
        print("Directory Sync Success!")
        
    except Exception as e:
        print(f"FAILED with error: {e}")

if __name__ == "__main__":
    asyncio.run(test_add())
