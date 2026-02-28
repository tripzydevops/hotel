
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def definitive_fix():
    db = get_supabase()
    
    KAZ_TOKEN = "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE"
    BAL_TOKEN = "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB"
    
    # NEW: Updated name to match SerpApi Knowledge Graph exactly
    KAZ_NAME = "Ramada Resort Kazdaglari Thermal and Spa"
    
    print("--- Fixing Hotels Table ---")
    # Kazdaglari
    res_kaz = db.table("hotels").select("id, name").ilike("name", "%Kazdaglari%").execute()
    for h in res_kaz.data:
        print(f"Updating {h['name']} ({h['id']}) -> Token: {KAZ_TOKEN}, Name: {KAZ_NAME}")
        db.table("hotels").update({
            "name": KAZ_NAME,
            "serp_api_id": KAZ_TOKEN,
            "property_token": KAZ_TOKEN,
            "updated_at": "2026-02-26T13:15:00Z"
        }).eq("id", h["id"]).execute()
        
    # Balikesir (excluding Kazdaglari)
    # Note: We keep the name as is but ensure the token is correct
    res_bal = db.table("hotels").select("id, name").ilike("name", "%Ramada Residences%Balikesir%").execute()
    for h in res_bal.data:
        if "Kazdaglari" not in h["name"]:
            print(f"Updating {h['name']} ({h['id']}) -> Token: {BAL_TOKEN}")
            db.table("hotels").update({
                "serp_api_id": BAL_TOKEN,
                "property_token": BAL_TOKEN,
                "updated_at": "2026-02-26T13:15:00Z"
            }).eq("id", h["id"]).execute()

    print("\n--- Fixing Hotel Directory ---")
    # Kazdaglari in directory
    dir_kaz = db.table("hotel_directory").select("id, name").ilike("name", "%Kazdaglari%").execute()
    for h in dir_kaz.data:
        print(f"Updating Directory {h['name']} ({h['id']}) -> Token: {KAZ_TOKEN}, Name: {KAZ_NAME}")
        db.table("hotel_directory").update({
            "name": KAZ_NAME,
            "serp_api_id": KAZ_TOKEN
        }).eq("id", h["id"]).execute()

if __name__ == "__main__":
    asyncio.run(definitive_fix())
