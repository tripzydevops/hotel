import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv
from uuid import UUID

load_dotenv('/home/tripzydevops/hotel/.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# We can't easily import the backend modules here due to pathing/deps
# but we can simulate the log count check.

async def verify_fix():
    hotel_id = '9be22665-9d2f-4496-8c2e-f028d029a05f'
    user_id = 'e927643b-cc5b-4835-9730-80a221f0088b'
    
    # 1. Count logs before
    res_before = supabase.table('price_logs').select('id', count='exact').eq('hotel_id', hotel_id).execute()
    count_before = res_before.count
    print(f"Log count before: {count_before}")

    print("Triggering scan via service logic simulation...")
    # Instead of running the whole agent mesh which is complex to set up in a script,
    # we can just use the scraper_agent and analyst_agent directly if we want to be thorough.
    
    import sys
    sys.path.append('/home/tripzydevops/hotel')
    from backend.agents.scraper_agent import ScraperAgent
    from backend.agents.analyst_agent import AnalystAgent
    from backend.models.schemas import ScanOptions
    
    scraper = ScraperAgent(supabase)
    analyst = AnalystAgent(supabase)
    
    # Get hotel data
    h_res = supabase.table('hotels').select('*').eq('id', hotel_id).single().execute()
    hotel = h_res.data
    
    # Run scraper (should be cache hit)
    options = ScanOptions(check_in='2026-03-03', check_out='2026-03-04', adults=2, currency='TRY')
    scrape_results = await scraper.run_scan(UUID(user_id), [hotel], options)
    
    print(f"Scrape Status: {scrape_results[0]['status']}")
    print(f"Source: {scrape_results[0]['price_data']['source']}")
    
    # Run analyst (this is where the fix is)
    await analyst.analyze_results(UUID(user_id), scrape_results, options=options)
    
    # 2. Count logs after
    res_after = supabase.table('price_logs').select('id', count='exact').eq('hotel_id', hotel_id).execute()
    count_after = res_after.count
    print(f"Log count after: {count_after}")
    
    if count_after == count_before:
        print("SUCCESS: No new price_logs entry created for cache hit. Cycle broken!")
    else:
        print("FAILURE: New price_log entry created for cache hit.")

if __name__ == "__main__":
    asyncio.run(verify_fix())
