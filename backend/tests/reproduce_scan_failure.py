import asyncio
import os
from datetime import date, timedelta
from dotenv import load_dotenv
from backend.agents.scraper_agent import ScraperAgent
from backend.services.provider_factory import ProviderFactory

# Load envs
load_dotenv()
load_dotenv(".env.local", override=True)

async def reproduce_scan():
    print("--- Starting Full Scan Reproduction ---")
    
    # Force Enable Serper (It might have been disabled in previous runs)
    # if "SERPER_API_KEY" in os.environ:
    #    del os.environ["SERPER_API_KEY"]
        
    # Check Provider Order (Should show SerpApi first now or Serper missing)
    providers = ProviderFactory.get_active_providers()
    print(f"Active Providers: {[p.get_provider_name() for p in providers]}")
    
    # Force check env vars
    print(f"SERPER_API_KEY Present: {bool(os.getenv('SERPER_API_KEY'))}")
    
    # Mock DB - run_scan usually just returns data, db might be for logging
    class MockDB:
        def table(self, name): return self
        def insert(self, data): return self
        def update(self, data): return self
        def eq(self, k, v): return self
        def execute(self): pass
        
    agent = ScraperAgent(db=MockDB())
    
    # Monkeypatch log_query to avoid DB errors
    async def mock_log_query(*args, **kwargs):
        pass
    import backend.agents.scraper_agent
    backend.agents.scraper_agent.log_query = mock_log_query
    check_in = date.today() + timedelta(days=30)
    check_out = check_in + timedelta(days=1)
    
    from uuid import uuid4
    from backend.models.schemas import ScanOptions
    
    # Needs a User ID (UUID)
    user_id = uuid4()
    
    # Needs a list of hotels
    hotels = [{
        "id": str(uuid4()),
        "name": "Hilton Garden Inn Balikesir",
        "location": "Balikesir",
        "serp_api_id": None
    }]
    
    # Needs ScanOptions object
    options = ScanOptions(
        check_in=check_in.strftime("%Y-%m-%d"),
        check_out=check_out.strftime("%Y-%m-%d"),
        currency="USD",
        adults=2
    )

    print("\nInvoking ScraperAgent.run_scan()...")
    result = await agent.run_scan(
        user_id=user_id,
        hotels=hotels,
        options=options
    )
    
    print("\n--- Scan Result ---")
    print(result)

if __name__ == "__main__":
    asyncio.run(reproduce_scan())
