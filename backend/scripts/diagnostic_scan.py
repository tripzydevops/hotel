
import asyncio
import os
from datetime import date, timedelta
from backend.services.serpapi_client import serpapi_client
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

async def test_diagnostic():
    hotel_name = "Willmont Hotel"
    location = "Balikesir"
    check_in = date(2026, 2, 23)
    check_out = check_in + timedelta(days=1)
    adults = 1
    currency = "TRY"
    
    print(f"--- Diagnosing {hotel_name} for {check_in} ({adults} adult) ---")
    
    # 1. Test with current logic
    result = await serpapi_client.fetch_hotel_price(
        hotel_name=hotel_name,
        location=location,
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        currency=currency
    )
    
    if result:
        print(f"Result: Price={result.get('price')}, Vendor={result.get('vendor')}")
        if result.get('price') is None:
            print("RAW DATA KEYS:", result.get('raw_data', {}).keys())
            # Print more raw data if price is missing
            raw = result.get('raw_data', {})
            print(f"Property Token: {raw.get('property_token')}")
            print(f"Rate Per Night: {raw.get('rate_per_night')}")
            print(f"Prices Array Length: {len(raw.get('prices', []))}")
            if raw.get('prices'):
                print("First Price Item:", raw['prices'][0])
    else:
        print("Result: None (Not found)")

if __name__ == "__main__":
    asyncio.run(test_diagnostic())
