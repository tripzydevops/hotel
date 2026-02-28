
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def check_ramadas():
    db = get_supabase()
    print("--- Ramada Data Check ---")
    
    # Search for Ramada hotels
    res = db.table("hotels").select("*").ilike("name", "%Ramada%").is_("deleted_at", "null").execute()
    print(f"Found {len(res.data)} Ramada hotels across all users.")
    
    for h in res.data:
        print(f"\nHotel: {h['name']} ({h['id']})")
        print(f"  User: {h['user_id']}")
        print(f"  SerpApi ID: {h.get('serp_api_id')}")
        print(f"  Property Token: {h.get('property_token')}")
        
        # Get latest price log
        logs = db.table("price_logs").select("*").eq("hotel_id", h['id']).order("recorded_at", desc=True).limit(1).execute()
        if logs.data:
            l = logs.data[0]
            print(f"  Latest Price: {l['price']} {l['currency']} at {l['recorded_at']}")
            print(f"  Log SerpApi ID: {l.get('serp_api_id')}")
        else:
            print("  No price logs found.")

if __name__ == "__main__":
    asyncio.run(check_ramadas())
