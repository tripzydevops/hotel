import asyncio
import os
import sys
import random
from uuid import UUID
from dotenv import load_dotenv
from supabase import create_client, Client

# Add project root to path
project_root = "/home/tripzydevops/hotel"
sys.path.append(project_root)

from backend.services.serpapi_client import serpapi_client

# Load environment
env_path = os.path.join(project_root, ".env.local")
load_dotenv(env_path)
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
db: Client = create_client(url, key)

USER_ID = "d33fc277-7006-468f-91b6-8cc7897fd910"

async def add_hotels():
    print(f"--- Adding 5 Balikesir Hotels to User {USER_ID} ---")
    
    try:
        # 1. Search for Hotels in Balikesir
        query = "Hotels in Balikesir, Turkey"
        print(f"Searching for: {query}...")
        results = await serpapi_client.search_hotels(query, limit=10)
        
        if not results:
            print("ERROR: No hotels found in Balikesir.")
            return

        # 2. Select 5 Random Hotels
        if len(results) > 5:
            selected = random.sample(results, 5)
        else:
            selected = results
            
        print(f"Selected {len(selected)} hotels.")

        for hotel in selected:
            name = hotel.get("name")
            location = hotel.get("location")
            token = hotel.get("serp_api_id")
            
            print(f"\nAdding: {name} ({location})")
            
            # 3. Insert into hotels table
            hotel_data = {
                "user_id": USER_ID,
                "name": name,
                "location": location,
                "is_target_hotel": False, # Randomly adding them as competitors/monitored
                "serp_api_id": token,
                "preferred_currency": "TRY",
            }
            
            res = db.table("hotels").insert(hotel_data).execute()
            if res.data:
                print(f"  - SUCCESS: Added with ID {res.data[0]['id']}")
            else:
                print(f"  - FAILED to add {name}")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(add_hotels())
