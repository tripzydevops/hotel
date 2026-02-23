import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

from backend.utils.db import get_supabase
from backend.agents.scraper_agent import ScraperAgent
from backend.models.schemas import ScanOptions

async def backfill_coordinates():
    db = get_supabase()
    
    print("Fetching hotels needing coordinates...")
    # Fetch all hotels (or just those without lat/lon if we could filter easily on nulls with current client)
    res = db.table("hotels").select("*").execute()
    hotels = res.data
    
    tasks = []
    scraper = ScraperAgent(db)
    
    print(f"Found {len(hotels)} hotels. triggering update scans...")
    
    targets = []
    target_users = set()
    
    for h in hotels:
        if not h.get("latitude") or not h.get("longitude"):
            targets.append(h)
            target_users.add(h["user_id"])
    
    if not targets:
        print("All hotels already have coordinates!")
        return

    print(f"{len(targets)} hotels missing coordinates. Starting scan...")
    
    # Analyze by user to keep logic simple (though run_scan takes a list)
    # We will just run them all in one go if they belong to same user, or split.
    # For now, let's just loop through unique users.
    
    for uid in target_users:
        user_hotels = [h for h in targets if h["user_id"] == uid]
        print(f"Processing {len(user_hotels)} hotels for User {uid}...")
        
        # We use a dummy session_id or None
        # We rely on ScraperAgent's internal 'update_payload' logic we just added.
        await scraper.run_scan(
             user_id=uid, 
             hotels=user_hotels, 
             options=ScanOptions(currency="USD") # Currency doesn't matter for geocoding
        )
        
    print("✅ Backfill Complete.")

if __name__ == "__main__":
    asyncio.run(backfill_coordinates())
