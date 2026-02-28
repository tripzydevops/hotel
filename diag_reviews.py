
import os
import asyncio
from supabase import create_client

async def check_reviews():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("Missing credentials")
        return
    
    supabase = create_client(url, key)
    res = supabase.table("hotels").select("id, name, rating, review_count").is_("deleted_at", "null").execute()
    
    print(f"--- Hotel Data ---")
    for h in (res.data or []):
        print(f"ID: {h['id']} | Name: {h['name']} | Rating: {h['rating']} | Reviews: {h.get('review_count')}")

if __name__ == "__main__":
    asyncio.run(check_reviews())
