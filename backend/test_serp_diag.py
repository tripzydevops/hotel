
import asyncio
import os
import httpx
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv()
load_dotenv(".env.local", override=True)
from backend.services.providers.serpapi_provider import SerpApiProvider

async def test_serpapi():
    provider = SerpApiProvider()
    keys = provider._key_manager._keys
    print(f"Loaded {len(keys)} keys:")
    for i, k in enumerate(keys):
        print(f"  Key {i+1}: {k[:5]}...{k[-5:]}")
    
    hotel_name = "Hilton Garden Inn Balikesir"
    location = "Balikesir"
    # Use the restored token
    serp_api_id = "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE"
    
    check_in = date.today() + timedelta(days=1)
    check_out = check_in + timedelta(days=1)
    
    print(f"Testing {hotel_name} (ID: {serp_api_id}) for {check_in}...")
    
    result = await provider.fetch_price(
        hotel_name=hotel_name,
        location=location,
        check_in=check_in,
        check_out=check_out,
        adults=2,
        currency="TRY",
        serp_api_id=serp_api_id
    )
    
    if result:
        print(f"SUCCESS: {result}")
    else:
        print("FAILED: No result found")

if __name__ == "__main__":
    asyncio.run(test_serpapi())
