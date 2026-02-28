
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env")
load_dotenv(".env.local", override=True)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diagnose_ramada():
    print("--- Diagnosing Ramada Kazdaglari ---")
    
    # Check directory
    dir_res = supabase.table("hotel_directory").select("*").ilike("name", "%Ramada%Kazdaglari%").execute()
    print(f"\nDirectory entries matching 'Ramada%Kazdaglari': {len(dir_res.data)}")
    for d in dir_res.data:
        print(f"ID: {d['id']}, Name: {d['name']}, SerpAPI ID: {d.get('serp_api_id')}")

    # Check hotels (user tracked)
    hotel_res = supabase.table("hotels").select("*").ilike("name", "%Ramada%Kazdaglari%").execute()
    print(f"\nTracked hotels matching 'Ramada%Kazdaglari': {len(hotel_res.data)}")
    for h in hotel_res.data:
        print(f"ID: {h['id']}, Name: {h['name']}, SerpAPI ID: {h.get('serp_api_id')}, User ID: {h['user_id']}")

if __name__ == "__main__":
    asyncio.run(diagnose_ramada())
