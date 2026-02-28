
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

async def check_directory_coverage():
    load_dotenv(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    
    print("Checking directory for hotels with missing metadata...")
    hotels_res = supabase.table("hotels").select("name, location, serp_api_id").is_("review_count", "null").is_("deleted_at", "null").execute()
    
    if not hotels_res.data:
        print("No hotels with missing review_count found in hotels table.")
        return

    for h in hotels_res.data:
        name = h["name"]
        loc = h["location"]
        print(f"\nChecking: {name} ({loc})")
        
        dir_res = supabase.table("hotel_directory").select("name, review_count, serp_api_id")\
            .eq("name", name)\
            .eq("location", loc)\
            .execute()
            
        if dir_res.data:
            d = dir_res.data[0]
            print(f"  FOUND in directory: {d.get('name')} | Reviews: {d.get('review_count')} | ID: {d.get('serp_api_id')}")
        else:
            print("  NOT FOUND in directory.")
            # Try fuzzy check by name only
            fuzzy_res = supabase.table("hotel_directory").select("name, review_count, location")\
                .ilike("name", f"%{name[:10]}%")\
                .execute()
            if fuzzy_res.data:
                print(f"  FUZZY matches in directory: {len(fuzzy_res.data)}")
                for f in fuzzy_res.data[:2]:
                    print(f"    - {f['name']} ({f.get('location')}) | Reviews: {f.get('review_count')}")

if __name__ == "__main__":
    asyncio.run(check_directory_coverage())
