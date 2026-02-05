import asyncio
import os
import json
from datetime import date, timedelta
from backend.services.providers.serpapi_provider import SerpApiProvider

async def inspect_serpapi_fidelity():
    """
    Runs a live scan against a known hotel (Hilton Istanbul) and prints 
    the RAW structure of 'offers' and 'room_types' to verify data availability.
    """
    provider = SerpApiProvider()
    
    # Target: A major hotel likely to have rich data
    hotel = "Hilton Istanbul Bomonti"
    location = "Istanbul, Turkey"
    check_in = date.today() + timedelta(days=14)
    check_out = date.today() + timedelta(days=15)
    
    print(f"--- Scanning {hotel} ---")
    
    # We use the internal fetch to get the raw parsing logic
    # But for this test, we want to see the RAW JSON to verify what we MIGHT be missing
    # So we'll bypass the provider's parser for a moment or inspect the 'raw_data' key if we added it
    
    result = await provider.fetch_price(hotel, location, check_in, check_out)
    
    if not result:
        print("Scan failed / No result.")
        return

    print("\n[Confirmed Data Fields]")
    print(f"- Price: {result.get('price')} {result.get('currency')}")
    print(f"- Rating: {result.get('rating')}")
    print(f"- Reviews: {result.get('reviews')}")
    
    # verify Offers (Parity Data)
    offers = result.get('offers', [])
    print(f"\n[Parity Data] Found {len(offers)} offers")
    for o in offers[:5]:
        print(f"  - {o['vendor']}: {o['price']} {o['currency']}")
        
    # Verify Room Types
    rooms = result.get('room_types', [])
    print(f"\n[Room Types] Found {len(rooms)} rooms")
    for r in rooms[:5]:
        print(f"  - {r['name']}: {r['price']}")
        
    # Verify Sentiment Breakdown (if available)
    breakdown = result.get('reviews_breakdown', [])
    print(f"\n[Sentiment] Found {len(breakdown)} breakdown items")
    print(json.dumps(breakdown, indent=2))

if __name__ == "__main__":
    asyncio.run(inspect_serpapi_fidelity())
