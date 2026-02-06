import os
import sys
import asyncio
from uuid import UUID, uuid4
from datetime import datetime
from unittest.mock import AsyncMock, patch
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

load_dotenv(".env.local", override=True)

# Mock BEFORE imports
mock_serpapi = AsyncMock()
with patch('backend.services.serpapi_client.SerpApiClient.fetch_hotel_price', mock_serpapi), \
     patch('backend.agents.scraper_agent.ScraperAgent.run_scan', new_callable=AsyncMock) as mock_agent_scan:
    
    from backend.main import get_supabase
    from backend.models.schemas import ScanOptions
    from backend.agents.analyst_agent import AnalystAgent
    
    # We actually want to test AnalystAgent logic, so we need to mock the INPUT to AnalystAgent
    # which comes from ScraperAgent results.
    
    async def verify_rank_persistence():
        db = get_supabase()
        if not db:
            print("Error: Supabase client not available")
            return

        # 1. Setup Test Data
        test_user_id = UUID("123e4567-e89b-12d3-a456-426614174000") # Dummy UUID for test
        test_hotel_id = uuid4()
        test_hotel_name = f"Rank Verification Hotel {datetime.now().strftime('%H:%M:%S')}"
        
        print(f"--- Step 1: Creating test hotel '{test_hotel_name}' ---")
        hotel_payload = {
            "id": str(test_hotel_id),
            "user_id": str(test_user_id),
            "name": test_hotel_name,
            "location": "Test City",
            "is_target_hotel": False
        }
        
        # We assume RLS allows this or we use service role key (which get_supabase does)
        try:
            db.table("hotels").insert(hotel_payload).execute()
        except Exception as e:
            print(f"Failed to create test hotel: {e}")
            return

        try:
            # 2. Simulate Scraper Result with Rank
            print("--- Step 2: Simulating Scraper Result with Rank #3 ---")
            scraper_results = [{
                "hotel_id": str(test_hotel_id),
                "status": "success",
                "check_in": datetime.now().date(),
                "price_data": {
                    "price": 150.0,
                    "currency": "USD",
                    "source": "serpapi",
                    "vendor": "Booking.com",
                    "search_rank": 3, # <--- THE KEY FIELD
                    "reviews": 100,
                    "rating": 4.5
                }
            }]
            
            # 3. Run Analyst Agent
            print("--- Step 3: Running Analyst Agent ---")
            analyst = AnalystAgent(db)
            await analyst.analyze_results(test_user_id, scraper_results, options=ScanOptions(currency="USD"))
            
            # 4. Verify Database
            print("--- Step 4: Verifying 'search_rank' in price_logs ---")
            logs = db.table("price_logs").select("*").eq("hotel_id", str(test_hotel_id)).order("recorded_at", desc=True).limit(1).execute()
            
            if logs.data:
                entry = logs.data[0]
                saved_rank = entry.get("search_rank")
                print(f"Saved Log Entry: Rank={saved_rank}, Price={entry['price']}")
                
                if saved_rank == 3:
                    print("✅ SUCCESS: search_rank correctly saved as 3")
                else:
                    print(f"❌ FAILURE: Expected rank 3, got {saved_rank}")
            else:
                print("❌ FAILURE: No price log found")

        finally:
            print("--- Step 5: Cleanup ---")
            db.table("price_logs").delete().eq("hotel_id", str(test_hotel_id)).execute()
            db.table("hotels").delete().eq("id", str(test_hotel_id)).execute()
            print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(verify_rank_persistence())
