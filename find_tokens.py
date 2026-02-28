
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def find_correct_tokens():
    db = get_supabase()
    print("--- Searching Hotel Directory ---")
    
    # 1. Look for Kazdaglari
    kaz = db.table("hotel_directory").select("*").ilike("name", "%Kazdaglari%").execute()
    print(f"\nPotential Kazdaglari matches in directory: {len(kaz.data)}")
    for k in kaz.data:
        print(f"  - {k['name']} | ID: {k['id']} | Token: {k.get('serp_api_id')}")

    # 2. Look for Balikesir Residences
    bal = db.table("hotel_directory").select("*").ilike("name", "%Residences%Balikesir%").execute()
    print(f"\nPotential Balikesir matches in directory: {len(bal.data)}")
    for b in bal.data:
        print(f"  - {b['name']} | ID: {b['id']} | Token: {b.get('serp_api_id')}")

if __name__ == "__main__":
    asyncio.run(find_correct_tokens())
