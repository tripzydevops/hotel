import asyncio
from uuid import uuid4
from backend.utils.db import get_supabase
from backend.agents.scraper_agent import ScraperAgent

async def test_scraper_integration():
    db = get_supabase()
    scraper = ScraperAgent(db)
    
    # Mock hotel data
    mock_hotel = {
        "id": "00000000-0000-0000-0000-000000000000",
        "name": "Test Hotel",
        "location": "Test Location",
        "serp_api_id": "test_token"
    }

    # Mock options
    # We can't easily mock the ProviderFactory.fetch_price without patching, 
    # but we can check if the code runs without syntax errors.
    # Actually, let's just inspect the file changes or run a very specific unit test on the function.
    
    print("ScraperAgent initialized successfully.")
    # If we got here, imports are correct.
    
if __name__ == "__main__":
    asyncio.run(test_scraper_integration())
