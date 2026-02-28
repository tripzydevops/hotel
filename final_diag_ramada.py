
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.utils.db import get_supabase

async def diag():
    db = get_supabase()
    print("--- Detailed Ramada Diagnostic ---")
    res = db.table("hotels").select("id, name, serp_api_id, property_token, user_id").ilike("name", "%Ramada%").execute()
    
    for h in res.data:
        print(f"Hotel: {h['name']}")
        print(f"  ID:   {h['id']}")
        print(f"  User: {h['user_id']}")
        print(f"  SERP: {h.get('serp_api_id')}")
        print(f"  PROP: {h.get('property_token')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(diag())
