import asyncio
import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Add backend to path
sys.path.append('/home/tripzydevops/hotel')

async def test_scrapers():
    print("--- Market Scrapers Verification ---")
    
    # Load env
    load_dotenv('/home/tripzydevops/hotel/.env.local')
    
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found.")
        return

    supabase: Client = create_client(url, key)
    
    # 1. Test TOBB Scraper (Headless Browser)
    print("\n[1/2] Testing TOBB Scraper...")
    try:
        from backend.services.market.tobb_scraper import TOBBScraper
        tobb = TOBBScraper(supabase)
        # We'll try to run the main orchestration
        # Note: This might be slow and requires playwright to be installed.
        tobb_res = await tobb.scrape_to_supabase()
        print(f"TOBB Result: {tobb_res}")
    except Exception as e:
        print(f"TOBB Scraper failed: {e}")

    # 2. Test TGA Scraper (GenAI / Firecrawl)
    print("\n[2/2] Testing TGA Scraper...")
    try:
        from backend.services.market.tga_scraper import TGAScraper
        tga = TGAScraper(supabase)
        # Note: Requires FIRECRAWL_API_KEY and GenAI setup
        tga_res = await tga.scrape_to_supabase()
        print(f"TGA Result: {tga_res}")
    except Exception as e:
        print(f"TGA Scraper failed: {e}")

    # Final Check
    print("\n--- Final Table Status ---")
    res = supabase.table("market_events").select("*", count="exact").execute()
    print(f"Total events in table: {res.count if hasattr(res, 'count') else len(res.data)}")

if __name__ == "__main__":
    asyncio.run(test_scrapers())
