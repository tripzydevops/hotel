import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv
from uuid import UUID
import sys

load_dotenv('/home/tripzydevops/hotel/.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def get_live_price():
    hotel_id = '9be22665-9d2f-4496-8c2e-f028d029a05f'
    user_id = 'e927643b-cc5b-4835-9730-80a221f0088b'
    
    print(f"Fetching live price for Hotel ID: {hotel_id}")
    
    sys.path.append('/home/tripzydevops/hotel')
    from backend.agents.scraper_agent import ScraperAgent
    from backend.agents.analyst_agent import AnalystAgent
    from backend.models.schemas import ScanOptions
    
    scraper = ScraperAgent(supabase)
    analyst = AnalystAgent(supabase)
    
    # Get hotel data
    h_res = supabase.table('hotels').select('*').eq('id', hotel_id).single().execute()
    hotel = h_res.data
    
    # Run scraper (Should MISS cache because we deleted zombie logs)
    options = ScanOptions(check_in='2026-03-03', check_out='2026-03-04', adults=2, currency='TRY')
    scrape_results = await scraper.run_scan(UUID(user_id), [hotel], options)
    
    res = scrape_results[0]
    print(f"Scan Status: {res['status']}")
    print(f"Source: {res['price_data'].get('source')}")
    print(f"Vendor: {res['price_data'].get('vendor')}")
    print(f"Live Price: {res['price_data'].get('price')} {res['price_data'].get('currency')}")
    
    # Run analyst to update the database with this fresh data
    await analyst.analyze_results(UUID(user_id), scrape_results, options=options)
    print("Database updated with live price.")

if __name__ == "__main__":
    asyncio.run(get_live_price())
