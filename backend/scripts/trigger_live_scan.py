import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

load_dotenv(".env.local", override=True)

from backend.utils.db import get_supabase
from backend.agents.scraper_agent import ScraperAgent
from backend.agents.analyst_agent import AnalystAgent
from backend.models.schemas import ScanOptions

async def trigger_scan():
    db = get_supabase()
    if not db:
        print("Error: Supabase client not available")
        return

    # 1. Get a user
    print("Finding a user...")
    # users = db.table("user_profiles").select("user_id").limit(1).execute()
    # if not users.data:
    #     print("No users found.")
    #     return
    
    # user_id = users.data[0]['user_id']
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"  # tripzydevops
    print(f"Using User ID: {user_id}")

    # 2. Get hotels for this user
    print("Fetching hotels...")
    hotels = db.table("hotels").select("*").eq("user_id", user_id).execute()
    if not hotels.data:
        print("No hotels found for this user.")
        return
    
    hotel_list = hotels.data
    print(f"Found {len(hotel_list)} hotels to scan: {[h['name'] for h in hotel_list]}")

    # 3. Initialize Agents
    scraper = ScraperAgent(db)
    analyst = AnalystAgent(db)

    # 4. Run Scan (Real, no mocks)
    print("Starting Live Scan (SerpApi)...")
    results = await scraper.run_scan(
        user_id=user_id,
        hotels=hotel_list,
        options=ScanOptions(currency="TRY") # Force TRY to test conversion if needed
    )
    
    print(f"Scan Complete. Processed {len(results)} hotels.")

    # 5. Analyze and Save (This triggers price_logs insert with rank)
    print("Analyzing Results...")
    summary = await analyst.analyze_results(
        user_id=user_id,
        scraper_results=results,
        options=ScanOptions(currency="TRY")
    )
    
    print("Analysis Summary:", summary)
    print("Done! Check the dashboard.")

if __name__ == "__main__":
    asyncio.run(trigger_scan())
