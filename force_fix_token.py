
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def final_fix():
    db = get_supabase()
    # Target: Ramada Resort Kazdaglari
    hid = "ab824508-de7b-45ec-8448-c12e2955735b"
    correct_token = "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE"
    
    print(f"Updating {hid} to {correct_token}...")
    res = db.table("hotels").update({
        "serp_api_id": correct_token,
        "property_token": correct_token,
        "updated_at": "2026-02-26T12:45:00Z" # Force update timestamp
    }).eq("id", hid).execute()
    
    print(f"Update Result Data: {res.data}")
    
    # Double check
    check = db.table("hotels").select("name, serp_api_id, property_token").eq("id", hid).single().execute()
    print(f"Verification Check: {check.data}")

if __name__ == "__main__":
    asyncio.run(final_fix())
