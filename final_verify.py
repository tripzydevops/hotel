
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def verify_prices():
    db = get_supabase()
    print("--- Final Price Verification ---")
    
    # 1. Ramada residences Balikesir
    res_b = "383a842a-eff8-4982-91ed-fef25026df28"
    # 2. Ramada Resort Kazdaglari
    res_k = "ab824508-de7b-45ec-8448-c12e2955735b"
    
    for hid in [res_b, res_k]:
        h_info = db.table("hotels").select("name, serp_api_id").eq("id", hid).single().execute()
        print(f"\nHotel: {h_info.data['name']} ({hid})")
        print(f"  Current DB Token: {h_info.data['serp_api_id']}")
        
        logs = db.table("price_logs").select("*").eq("hotel_id", hid).order("recorded_at", desc=True).limit(1).execute()
        if logs.data:
            l = logs.data[0]
            print(f"  Latest Log Price: {l['price']} {l['currency']}")
            print(f"  Latest Log Token: {l['serp_api_id']}")
            print(f"  Recorded At: {l['recorded_at']}")
        else:
            print("  No price logs found for this hotel.")

if __name__ == "__main__":
    asyncio.run(verify_prices())
