
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

# Load envs
load_dotenv(".env")
load_dotenv(".env.local", override=True)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials")
    exit(1)

supabase = create_client(url, key)

def check_hotel():
    target_name = "Ramada Resort by Wyndham Kazdaglari Thermal and Spa"
    target_token = "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE"
    
    print(f"Checking DB for: {target_name}")
    
    # 1. Search by name (fuzzy)
    response = supabase.table("hotels").select("*").ilike("name", f"%Ramada Resort by Wyndham Kazdaglari%").execute()
    
    hotels = response.data
    
    if not hotels:
        print("No hotel found in DB matching that name.")
        return

    for hotel in hotels:
        print(f"Found Hotel: {hotel['name']}")
        print(f"Current serp_api_id: {hotel.get('serp_api_id')}")
        
        if hotel.get('serp_api_id') != target_token:
            print(f"Updating ID to {target_token}...")
            supabase.table("hotels").update({"serp_api_id": target_token}).eq("id", hotel["id"]).execute()
            print("Update success.")
        else:
            print("ID matches property_token. All good.")

if __name__ == "__main__":
    check_hotel()
