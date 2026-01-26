import asyncio
import os
import json
from datetime import date, timedelta
from backend.services.serpapi_client import serpapi_client

async def test_fetch():
    print("Fetching prices for Swissotel The Bosphorus Istanbul...")
    
    # Use a date 2 weeks from now
    check_in = date.today() + timedelta(days=14)
    check_out = check_in + timedelta(days=1)
    
    result = await serpapi_client.fetch_hotel_price(
        hotel_name="Swissotel The Bosphorus",
        location="Istanbul, Turkey",
        check_in=check_in,
        check_out=check_out,
        currency="USD"
    )
    
    if result:
        print(f"\n[FOUND] Hotel: {result.get('hotel_name')}")
        print(f"Source: {result.get('source')}")
        
        offers = result.get('offers', [])
        print(f"\nfound {len(offers)} offers:")
        for offer in offers:
            print(f" - {offer.get('vendor')}: {offer.get('currency')} {offer.get('price')}")
            
        print("\nRaw lowest rate:", result.get('price'))
    else:
        print("❌ No results found.")

if __name__ == "__main__":
    asyncio.run(test_fetch())
