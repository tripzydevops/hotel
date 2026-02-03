
import asyncio
import os
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(".env.local", override=True)
load_dotenv()

from backend.services.provider_factory import ProviderFactory

async def test_providers():
    print(f"--- API Health Check ---")
    print(f"RAPIDAPI_KEY: {'Present' if os.getenv('RAPIDAPI_KEY') else 'MISSING'}")
    print(f"SERPER_API_KEY: {'Present' if os.getenv('SERPER_API_KEY') else 'MISSING'}")
    print(f"SERPAPI_API_KEY: {'Present' if os.getenv('SERPAPI_API_KEY') else 'MISSING'}")
    print(f"DECODO_API_KEY: {'Present' if os.getenv('DECODO_API_KEY') else 'MISSING'}")
    
    providers = ProviderFactory.get_active_providers()
    print(f"Active Providers: {[p.get_provider_name() for p in providers]}")
    
    check_in = date.today() + timedelta(days=1)
    check_out = check_in + timedelta(days=1)
    
    hotel_name = "Hilton Garden Inn Balikesir"
    location = "Balikesir"
    
    for provider in providers:
        print(f"\nTesting {provider.get_provider_name()}...")
        try:
            res = await provider.fetch_price(
                hotel_name=hotel_name,
                location=location,
                check_in=check_in,
                check_out=check_out
            )
            if res:
                print(f"  SUCCESS: Price = {res.get('price')} {res.get('currency')} via {res.get('vendor')}")
            else:
                print(f"  FAILED: Returned None")
        except Exception as e:
            print(f"  ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_providers())
