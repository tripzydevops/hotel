
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def fix_ramada_tokens():
    db = get_supabase()
    print("--- Fixing Ramada Tokens ---")
    
    # 1. Fix Ramada Resort By Wyndham Kazdaglari Thermal And Spa
    # Correct Token: ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE
    kaz_id = "ab824508-de7b-45ec-8448-c12e2955735b"
    res1 = db.table("hotels").update({
        "serp_api_id": "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE",
        "property_token": "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE"
    }).eq("id", kaz_id).execute()
    
    if res1.data:
        print(f"Updated Kazdaglari ({kaz_id}) with correct token.")
    else:
        print(f"Failed to update Kazdaglari ({kaz_id}). Check if ID is correct.")

    # 2. Fix the other instance if it exists (for the other user)
    # The scan logs showed another Ramada Residences Balikesir with the same (incorrect) Balikesir token.
    # We should ensure all hotels have the correct directory mappings.
    
    # Actually, let's just make sure all Ramada Kazdaglari instances are correct
    res2 = db.table("hotels").update({
        "serp_api_id": "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE",
        "property_token": "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE"
    }).ilike("name", "%Kazdaglari%").execute()
    
    print(f"Updated {len(res2.data)} Kazdaglari records in total.")

    print("\n--- Verification ---")
    final = db.table("hotels").select("id, name, serp_api_id").ilike("name", "%Ramada%").execute()
    for h in final.data:
        print(f"  - {h['name']}: {h['serp_api_id']}")

if __name__ == "__main__":
    asyncio.run(fix_ramada_tokens())
