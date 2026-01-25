import asyncio
import sys
import os
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from services.serpapi_client import SerpApiClient

async def main():
    client = SerpApiClient()
    
    print("\n--- STEP 1: Find Hilton Balikesir Token ---")
    # First search to get the token
    result1 = await client.fetch_hotel_price(
        hotel_name="Hilton Garden Inn Balikesir", 
        location="Balikesir, Turkey", 
        currency="USD"
    )
    
    if not result1:
        print("Could not find hotel.")
        return

    token = result1.get("property_token")
    print(f"Found Token: {token}")
    
    if not token:
        print("No token returned in basic search. Cannot proceed to Step 2.")
        return

    print("\n--- STEP 2: Search BY TOKEN (Deep Search) ---")
    # Second search using the token
    # We modify the client to print the raw result if we can, or just inspect what comes back
    # The client._parse_hotel_result returns "raw_data" key now if I recall correctly from my read
    
    result2 = await client.fetch_hotel_price(
        hotel_name="Hilton Garden Inn Balikesir", 
        location="Balikesir, Turkey", 
        currency="USD",
        serp_api_id=token
    )
    
    if result2 and "raw_data" in result2:
        print("\n--- RAW DATA PREVIEW (First 2000 chars) ---")
        raw_json = json.dumps(result2["raw_data"], indent=2)
        print(raw_json[:2000])
        print("...\n(Truncated)")
        
        # Check for specific fields of interest
        print("\n--- DATA ANALYSIS ---")
        data = result2["raw_data"]
        print(f"Amenities: {len(data.get('amenities', []))} found")
        print(f"Images: {len(data.get('images', []))} found")
        print(f"Description: {bool(data.get('description'))}")
        print(f"Prices List: {len(data.get('prices', []))} offers found")
        
        if data.get('prices'):
            print("Offers:")
            for p in data['prices'][:3]:
                print(f" - {p.get('source')}: {p.get('rate_per_night', {}).get('lowest')}")

if __name__ == "__main__":
    asyncio.run(main())
