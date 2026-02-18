
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

async def restore_ramada():
    print(f"--- Restoring Ramada for User {USER_ID} ---")
    
    # 1. Clear any existing target flags for this user
    print("Clearing existing target flags...")
    supabase.table("hotels").update({"is_target_hotel": False}).eq("user_id", USER_ID).execute()
    
    # 2. Add Ramada as Target
    hotel_data = {
        "user_id": USER_ID,
        "name": "Ramada Residences By Wyndham Balikesir",
        "location": "Balikesir, Turkey",
        "is_target_hotel": True,
        "preferred_currency": "TRY",
        "serp_api_id": "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB",
        "latitude": 39.6053,
        "longitude": 27.9158,
        "rating": 4.6,
        "review_count": 120,
        "image_url": "https://lh5.googleusercontent.com/p/AF1QipN_-7_9-m5k8-8_v_-7_9-m5k8-8_v_-7_9-m5k8"
    }
    
    print("Inserting Ramada hotel...")
    res = supabase.table("hotels").insert(hotel_data).execute()
    if res.data:
        print("Ramada restored successfully.")
    else:
        print("Failed to restore Ramada.")

if __name__ == "__main__":
    asyncio.run(restore_ramada())
