from backend.agents.scraper_agent import ScraperAgent
from supabase import Client
from datetime import date, timedelta
import asyncio
from unittest.mock import MagicMock

# Mock DB interaction
class MockDB:
    def table(self, name):
        return self
    def update(self, data):
        return self
    def insert(self, data):
        return self
    def eq(self, col, val):
        return self
    def execute(self):
        return None

async def verify_scan():
    print("--- Verifying ScraperAgent with RapidAPI ---")
    mock_db = MockDB()
    agent = ScraperAgent(db=mock_db)
    
    check_in = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
    check_out = (date.today() + timedelta(days=31)).strftime("%Y-%m-%d")

    hotels = [
        {
            "id": "test-uuid",
            "name": "Hilton Garden Inn Balikesir",
            "location": "Balikesir, Turkey",
            "fixed_check_in": check_in,
            "fixed_check_out": check_out,
            "default_adults": 2
        }
    ]
    
    print(f"Scanning for: {hotels[0]['name']}")
    results = await agent.run_scan(user_id="user-123", hotels=hotels, options=None)
    
    for res in results:
        print(f"\nResult for {res['hotel_name']}:")
        print(f"Status: {res['status']}")
        if res['price_data']:
            pd = res['price_data']
            print(f"Price: {pd.get('price')} {pd.get('currency')}")
            print(f"Vendor: {pd.get('vendor')} (Source: {pd.get('source')})")
            print(f"Metadata: Photos={len(pd.get('photos', []))}, CheckIn={pd.get('checkin_time')}")
        else:
            print("No Price Data Found.")

if __name__ == "__main__":
    asyncio.run(verify_scan())
