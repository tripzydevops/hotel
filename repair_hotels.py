
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

async def repair_hotel_metadata():
    load_dotenv(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    
    print("Fetching hotels with missing metadata...")
    res = supabase.table("hotels").select("id, name, location, serp_api_id, review_count, rating, image_url").is_("deleted_at", "null").execute()
    
    if not res.data:
        print("No hotels found.")
        return

    updated_count = 0
    for h in res.data:
        needs_update = False
        update_payload = {}
        
        # Check if basic metadata is missing
        if h.get("review_count") is None or h.get("rating") is None or h.get("image_url") is None:
            # Try to find in directory
            dir_res = supabase.table("hotel_directory").select("*")\
                .eq("name", h["name"])\
                .eq("location", h["location"])\
                .execute()
            
            if dir_res.data:
                d = dir_res.data[0]
                if h.get("review_count") is None and d.get("review_count") is not None:
                    update_payload["review_count"] = d["review_count"]
                    needs_update = True
                if h.get("rating") is None and d.get("rating") is not None:
                    update_payload["rating"] = d["rating"]
                    needs_update = True
                if h.get("image_url") is None and d.get("image_url") is not None:
                    update_payload["image_url"] = d["image_url"]
                    needs_update = True
                if h.get("serp_api_id") is None and d.get("serp_api_id") is not None:
                    update_payload["serp_api_id"] = d["serp_api_id"]
                    needs_update = True

        if needs_update:
            print(f"Repairing {h['name']}...")
            supabase.table("hotels").update(update_payload).eq("id", h["id"]).execute()
            updated_count += 1

    print(f"Repair complete. {updated_count} hotels updated.")

if __name__ == "__main__":
    asyncio.run(repair_hotel_metadata())
