
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

async def inspect():
    print("--- Inspecting Hotel Directory for 'Ramada' in 'Balikesir' ---")
    res = supabase.table("hotel_directory").select("*").ilike("name", "%Ramada%").ilike("name", "%Balikesir%").execute()
    
    for item in res.data:
        print(f"Name: {item.get('name')}")
        print(f"Location: {item.get('location')}")
        print(f"Token: {item.get('serp_api_id')}")
        print(f"ID: {item.get('id')}") # directory ID if exists
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(inspect())
