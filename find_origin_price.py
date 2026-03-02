import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/tripzydevops/hotel/.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def find_origin_price():
    print("Searching for origin price (not cache) for Check-in: 2026-03-03...")
    
    # Fetch all logs for this check-in date across all hotels
    res = supabase.table('price_logs').select('*').eq('check_in_date', '2026-03-03').order('recorded_at', desc=True).limit(50).execute()
    
    if not res.data:
        print("No logs found for Mar 3.")
        return

    print(f"Found {len(res.data)} logs.")
    orig_log = None
    for l in res.data:
        # Check source. If it's not global_cache, it's our candidate.
        source = l.get('source')
        if source != 'global_cache':
            print(f"Candidate origin found: {l['recorded_at']} | Price: {l['price']} | Source: {source} | Hotel ID: {l['hotel_id']}")
            orig_log = l
            break
    
    if not orig_log:
        print("All logs in the first 50 results were from global_cache.")
        # Try a different query for non-cache
        res2 = supabase.table('price_logs').select('*').eq('check_in_date', '2026-03-03').neq('source', 'global_cache').order('recorded_at', desc=True).limit(5).execute()
        if res2.data:
            print("\nFound non-cache logs via filtering:")
            for l in res2.data:
                print(f"  {l['recorded_at']} | Price: {l['price']} | Source: {l['source']}")
        else:
            print("\nTruly no non-cache logs found for Mar 3 in recent history.")

if __name__ == "__main__":
    asyncio.run(find_origin_price())
