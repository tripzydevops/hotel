import os
import asyncio
import httpx
from datetime import date, timedelta
from dotenv import load_dotenv
from supabase import create_client
from backend.services.serpapi_client import SerpApiClient

load_dotenv()

async def backfill_all_hotels():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    # Initialize client (will automatically use rotating keys)
    client = SerpApiClient()
    
    # 1. Get all hotels missing review count
    print("Fetching hotels with missing metadata...")
    res = supabase.table("hotels").select("id, name, location, serp_api_id, user_id").is_("review_count", "null").execute()
    hotels = res.data
    
    print(f"Found {len(hotels)} hotels to backfill.")
    
    for h in hotels:
        name = h["name"]
        loc = h["location"]
        sid = h["serp_api_id"]
        hid = h["id"]
        
        print(f"Processing {name} ({loc})...")
        
        # We need check-in dates for Key 3 to work
        check_in = date.today() + timedelta(days=7)
        check_out = check_in + timedelta(days=1)
        
        result = await client.fetch_hotel_price(name, loc, check_in, check_out, serp_api_id=sid)
        
        if result and "error" not in result:
            review_count = result.get("review_count")
            rating = result.get("rating")
            stars = result.get("stars")
            image_url = result.get("image_url") or result.get("images", [{}])[0].get("thumbnail") if result.get("images") else None
            
            print(f"  Fetched: {review_count} reviews, {rating} rating.")
            
            # Update Hotels Table
            update_data = {}
            if review_count is not None: update_data["review_count"] = review_count
            if rating is not None: update_data["rating"] = rating
            if stars is not None: update_data["stars"] = stars
            if image_url is not None: update_data["image_url"] = image_url
            
            if update_data:
                supabase.table("hotels").update(update_data).eq("id", hid).execute()
                print(f"  Updated hotels table for {name}")
                
            # Attempt to update hotel_directory (Global Master)
            # EXPLANATION: This ensures other users who discover this hotel later get the data too
            dir_update = {
                "name": name,
                "location": loc,
                "serp_api_id": sid,
                "rating": rating,
                "stars": stars,
                "image_url": image_url
            }
            # Note: review_count is still missing in directory schema, so we skip it to prevent errors
            supabase.table("hotel_directory").upsert(dir_update, on_conflict="serp_api_id").execute()
            print(f"  Synced to master directory (partial).")
            
        else:
            print(f"  Failed to fetch data for {name}: {result}")
        
        # Small delay to be polite to API
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(backfill_all_hotels())
