import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from backend.agents.scraper_agent import ScraperAgent
from uuid import uuid4

async def test_scraper_room_normalization():
    # Mock DB
    mock_db = MagicMock()
    # Mock log_reasoning to avoid DB writes
    mock_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {}
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = None
    
    agent = ScraperAgent(mock_db)
    agent.log_reasoning = AsyncMock() # Skip DB logging
    agent._check_global_cache = AsyncMock(return_value=None) # Force API call

    # Mock Provider
    mock_provider = AsyncMock()
    mock_provider.get_provider_name.return_value = "MockProvider"
    mock_provider.fetch_price.return_value = {
        "price": 100,
        "currency": "USD",
        "room_types": [
            {"name": "Deluxe King Room", "price": 120},
            {"name": "Standard Twin", "price": 100},
            {"name": "Super Duper Suite", "price": 500}
        ]
    }

    with patch("backend.services.provider_factory.ProviderFactory.get_provider", return_value=mock_provider):
        hotels = [{"id": str(uuid4()), "name": "Test Hotel", "serp_api_id": "123"}]
        options = MagicMock()
        options.check_in = "2026-06-01"
        options.check_out = "2026-06-02"
        options.adults = 2
        options.currency = "USD"
        
        results = await agent.run_scan(uuid4(), hotels, options, session_id=uuid4())
        
        assert len(results) == 1
        res = results[0]
        assert res["status"] == "success"
        
        rooms = res["price_data"]["room_types"]
        assert len(rooms) == 3
        
        # Check Normalization
        # 1. Deluxe King -> KNG-DLX
        r1 = next(r for r in rooms if r["name"] == "Deluxe King Room")
        assert r1["canonical_code"] == "KNG-DLX"
        assert r1["canonical_name"] == "King Deluxe"
        
        # 2. Standard Twin -> TW-STD (or similar)
        r2 = next(r for r in rooms if r["name"] == "Standard Twin")
        assert r2["canonical_code"] == "TW-STD"
        
        # 3. Super Duper -> ROH (Unknown)
        r3 = next(r for r in rooms if r["name"] == "Super Duper Suite")
        assert r3["canonical_code"] == "STE" # Suite token maps to STE!
        
        print("\nTest Passed: Room Normalization verification successful!")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    loop.run_until_complete(test_scraper_room_normalization())
