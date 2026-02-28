
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def check_and_fix():
    db = get_supabase()
    print("--- Rigorous Data Check & Fix ---")
    
    # 1. List ALL Ramadas
    res = db.table("hotels").select("*").ilike("name", "%Ramada%").execute()
    print(f"Total Ramada hotels in system: {len(res.data)}")
    
    for h in res.data:
        name = h['name']
        hid = h['id']
        curr_serp = h.get('serp_api_id')
        
        print(f"\nProcessing: {name} ({hid})")
        print(f"  Current Token: {curr_serp}")
        
        # Decide correct token
        correct_token = None
        if "Kazdaglari" in name:
            correct_token = "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE"
        elif "Balikesir" in name:
            correct_token = "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB"
        
        if correct_token and curr_serp != correct_token:
            print(f"  --> FIXING: Updating to {correct_token}")
            upd = db.table("hotels").update({
                "serp_api_id": correct_token,
                "property_token": correct_token
            }).eq("id", hid).execute()
            if upd.data:
                print("  --> SUCCESS: Updated.")
            else:
                print("  --> FAILED: Update did not return data.")
        else:
            print("  --> OK: Already correct or no rule for this hotel.")

if __name__ == "__main__":
    asyncio.run(check_and_fix())
