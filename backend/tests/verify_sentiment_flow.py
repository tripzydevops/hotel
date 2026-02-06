
import asyncio
import os
import sys
from uuid import uuid4
from dotenv import load_dotenv

# Add project root
sys.path.append(os.getcwd())

from backend.models.schemas import ScanOptions
from backend.agents.scraper_agent import ScraperAgent
from backend.services.provider_factory import ProviderFactory
from supabase import create_client

# Mock Provider
class MockProvider:
    def get_provider_name(self): return "MockProvider"
    async def fetch_price(self, **kwargs):
        print("[Mock] Returning dummy data with sentiment...")
        return {
            "status": "success",
            "price": 150.0,
            "currency": "USD",
            "rating": 4.8,
            "reviews_breakdown": [
                {"name": "Rooms", "rating": 4.9, "total": 10},
                {"name": "Service", "rating": 4.7, "total": 8}
            ],
            "reviews": [
                {"text": "Amazing rooms!", "sentiment": "positive", "date": "2026-02-01"},
                {"text": "Service was okay.", "sentiment": "neutral", "date": "2026-01-20"}
            ]
        }

async def verify():
    load_dotenv()
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    db = create_client(url, key)
    
    # 1. Create Dummy Hotel
    user_id = "00000000-0000-0000-0000-000000000000" # Implies we need a real user or we skip FK? 
    # Actually, hotels table has FK to users. We need a real user ID.
    # Let's fetch the first user.
    users = db.table("user_profiles").select("user_id").limit(1).execute()
    if not users.data:
        print("No users found to test with.")
        return
        
    real_user_id = users.data[0]["user_id"]
    print(f"Testing with User: {real_user_id}")
    
    hotel_id = str(uuid4())
    db.table("hotels").insert({
        "id": hotel_id,
        "user_id": real_user_id,
        "name": "Sentiment Test Hotel",
        "is_target_hotel": False
    }).execute()
    print(f"Created Hotel: {hotel_id}")
    
    # 2. Run Scraper with Mock
    # Monkey-patch provider factory
    ProviderFactory.get_provider = lambda: MockProvider()
    
    agent = ScraperAgent(db)
    hotels = [{"id": hotel_id, "name": "Sentiment Test Hotel"}]
    
    from datetime import date, timedelta
    today = date.today()
    opts = ScanOptions(
        currency="USD",
        check_in=today,
        check_out=today + timedelta(days=1)
    )
    await agent.run_scan(real_user_id, hotels, opts)
    
    # 3. Verify Persistence
    res = db.table("hotels").select("sentiment_breakdown, reviews").eq("id", hotel_id).single().execute()
    print("\n--- DB RESULTS ---")
    import json
    print(json.dumps(res.data, indent=2))
    
    # Cleanup
    db.table("hotels").delete().eq("id", hotel_id).execute()
    print("Cleanup done.")

if __name__ == "__main__":
    asyncio.run(verify())
