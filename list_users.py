
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def list_users_and_hotels():
    db = get_supabase()
    print("--- User & Hotel List ---")
    profiles = db.table("user_profiles").select("user_id, email").execute()
    for p in profiles.data:
        uid = p['user_id']
        hotels = db.table("hotels").select("id", count="exact").eq("user_id", uid).is_("deleted_at", "null").execute()
        print(f"User: {p['email']} ({uid}), Hotels: {hotels.count}")

if __name__ == "__main__":
    asyncio.run(list_users_and_hotels())
