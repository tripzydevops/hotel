
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

async def check_db_state():
    # Load from .env.local if .env is insufficient
    load_dotenv(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    
    print("Fetching hotels with zero or null reviews...")
    res = supabase.table("hotels").select("id, name, rating, review_count, created_at").is_("deleted_at", "null").execute()
    
    if res.data:
        print(f"{'Name':<30} | {'Reviews':<10} | {'Rating':<10} | {'Created At'}")
        print("-" * 75)
        for h in res.data:
            reviews = h.get("review_count")
            name = h.get("name", "Unknown")
            rating = h.get("rating")
            created = h.get("created_at")
            print(f"{name[:30]:<30} | {str(reviews):<10} | {str(rating):<10} | {created}")
    else:
        print("No hotels found.")

if __name__ == "__main__":
    asyncio.run(check_db_state())
