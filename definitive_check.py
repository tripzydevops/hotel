
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def check_once_and_for_all():
    db = get_supabase()
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    print(f"--- Definitive Check for User {user_id} ---")
    
    res = db.table("hotels").select("*").eq("user_id", user_id).is_("deleted_at", "null").execute()
    for h in res.data:
        print(f"NAME: {h['name']}")
        print(f"  ID: {h['id']}")
        print(f"  SERP_API_ID: {h.get('serp_api_id')}")
        print(f"  PROPERTY_TOKEN: {h.get('property_token')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_once_and_for_all())
