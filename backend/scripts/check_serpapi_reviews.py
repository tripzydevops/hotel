
import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

from backend.services.serpapi_client import serpapi_client

async def inspect():
    print("Fetching data for 'Hilton Istanbul Bomonti'...")
    # Using a known big hotel to ensure reviews exist
    result = await serpapi_client.fetch_hotel_price(
        hotel_name="Hilton Istanbul Bomonti",
        location="Istanbul",
        currency="USD"
    )
    
    if result:
        print("\n--- REVIEWS BREAKDOWN ---")
        breakdown = result.get("reviews_breakdown", [])
        import json
        print(json.dumps(breakdown, indent=2))
        
        print("\n--- RAW KEYS AVAILABLE ---")
        print(result.keys())
    else:
        print("No result found.")

if __name__ == "__main__":
    asyncio.run(inspect())
