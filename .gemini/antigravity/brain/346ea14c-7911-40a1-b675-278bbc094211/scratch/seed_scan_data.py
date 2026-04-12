import asyncio
import os
import sys
from uuid import uuid4

# Add parent directory to path
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase_client

async def main():
    db = get_supabase_client(admin=True) # Use admin key to bypass RLS
    if not db:
        print("Failed to get DB client")
        return

    # 1. Create a test hotel
    hotel_name = "The Londoner Hotel"
    location = "London, UK"
    
    # Check if exists
    existing = db.table("hotels").select("id").eq("name", hotel_name).execute()
    if existing.data:
        hotel_id = existing.data[0]["id"]
        print(f"Hotel '{hotel_name}' already exists with ID: {hotel_id}")
    else:
        res = db.table("hotels").insert({
            "name": hotel_name,
            "location": location,
            "serp_api_id": "londoner_hotel_test" # Dummy token
        }).execute()
        hotel_id = res.data[0]["id"]
        print(f"Created Hotel '{hotel_name}' with ID: {hotel_id}")

    # 2. Link to a user (using the id from admin_settings or a dummy)
    user_id = "00000000-0000-0000-0000-000000000000" # Using the system admin ID
    
    assoc_res = db.table("user_hotels").upsert({
        "user_id": user_id,
        "hotel_id": hotel_id,
        "is_monitored": True
    }, on_conflict="user_id, hotel_id").execute()
    
    print(f"Associated hotel with system user in 'user_hotels'. Monitoring enabled.")

if __name__ == "__main__":
    asyncio.run(main())
