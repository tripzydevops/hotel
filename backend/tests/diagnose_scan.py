import asyncio
import os
from dotenv import load_dotenv
# Explicitly load env vars if needed
load_dotenv()

from backend.services.serpapi_client import SerpApiClient

# Re-initialize client (it will pick up env vars)
serpapi_client = SerpApiClient()

async def test_search():
    hotels_to_test = [
        {"name": "Ramada Residences By Wyndham Balikesir", "location": "Balikesir", "currency": "TRY"},
        {"name": "Hilton Garden Inn", "location": "Balikesir", "currency": "USD"}, # From screenshot
        {"name": "Altın Otel & Spa", "location": "Balikesir", "currency": "TRY"},
    ]

    print(f"--- Testing SerpApi Fetch for {len(hotels_to_test)} hotels ---")
    print(f"Active Key: {serpapi_client.api_key[:5]}...")

    for hotel in hotels_to_test:
        print(f"\nScanning: {hotel['name']} in {hotel['location']} ({hotel['currency']})")
        try:
            result = await serpapi_client.fetch_hotel_price(
                hotel_name=hotel["name"],
                location=hotel["location"],
                currency=hotel["currency"]
            )
            
            if result:
                print("✅ SUCCESS!")
                print(f"  Price: {result.get('price')} {result.get('currency')}")
                print(f"  Url: {result.get('image_url')}")
                print(f"  Vendor: {result.get('vendor')}")
            else:
                print("❌ FAILED - No data returned")
        
        except Exception as e:
            print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_search())
