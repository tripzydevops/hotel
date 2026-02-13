import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.testing')
url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(url, key)

async def verify_enrichment():
    # User ID for testing
    user_id = 'eb284dd9-7198-47be-acd0-fdb0403bcd0a' # From previous logs
    
    print("--- VERIFYING DASHBOARD ENRICHMENT ---")
    # Simulate get_dashboard_logic roughly
    res = supabase.table("hotels").select("*").eq("user_id", user_id).execute()
    hotels = res.data
    print(f"Active Hotels: {len(hotels)}")
    
    # Check for duplicates
    names = [h['name'] for h in hotels]
    import collections
    dupes = [item for item, count in collections.Counter(names).items() if count > 1]
    print(f"Duplicates found: {dupes} (Should be empty)")

    # Check for historical data bridge
    print("\n--- CHECKING HISTORICAL DATA BRIDGE (QUERY_LOGS) ---")
    for h in hotels:
        # Check from query_logs for this hotel name
        q_res = supabase.table("query_logs").select("id").eq("hotel_name", h['name']).not_.is_("price", "null").limit(5).execute()
        print(f"Hotel '{h['name']}': {len(q_res.data)} legacy price records found.")

    # Check for directory join
    print("\n--- CHECKING DIRECTORY JOIN (METADATA) ---")
    serp_ids = [h['serp_api_id'] for h in hotels if h.get('serp_api_id')]
    if serp_ids:
        dir_res = supabase.table("hotel_directory").select("name, location, image_url").in_("serp_api_id", serp_ids).execute()
        print(f"Directory matches found: {len(dir_res.data)} / {len(serp_ids)}")
        for d in dir_res.data:
            print(f"- {d['name']}: Location={d.get('location')}, Image={'Yes' if d.get('image_url') else 'No'}")

if __name__ == "__main__":
    asyncio.run(verify_enrichment())
