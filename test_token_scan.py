import asyncio
import sys
import os
import json
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from services.serpapi_client import SerpApiClient

# Load .env.local explicitly to get the Vercel keys
load_dotenv(".env.local")

async def main():
    # Use the token provided by the user
    token = "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE"
    name = "Hilton Garden Inn Balikesir (Test)"
    
    print(f"\n[INFO] Starting Deep Scan for {name}...")
    print(f"[INFO] Token: {token}")
    
    # Check if we have key now
    api_key_2 = os.getenv("SERPAPI_API_KEY_2")
    if api_key_2:
        print(f"Using Secondary Key: {api_key_2[:5]}...")
        # Monkey patch environment or init client with specific key list
        os.environ["SERPAPI_API_KEY"] = api_key_2
    else:
        print("Warning: SERPAPI_API_KEY_2 not found.")

    client = SerpApiClient()
    # Force reload to pick up the new env vars we just loaded
    client.reload()
    
    try:
        result = await client.fetch_hotel_price(
            hotel_name=name, 
            location="Balikesir, Turkey", 
            currency="USD",
            serp_api_id=token
        )
        
        if result:
            print("\n[SUCCESS] SCAN SUCCESS!")
            print(f"Price: {result.get('price')} {result.get('currency')}")
            print(f"Source: {result.get('source')}")
            
            # Verify Rich Data
            amenities = result.get('raw_data', {}).get('amenities', [])
            images = result.get('raw_data', {}).get('images', [])
            offers = result.get('raw_data', {}).get('prices', [])
            
            print("\n[RICH DATA CHECK]")
            print(f" - Amenities Header Found: {len(amenities)} items")
            print(f" - Images Header Found: {len(images)} items")
            print(f" - Offers Header Found: {len(offers)} items")
            
            if "raw_data" in result:
                data = result["raw_data"]
                print("\n--- RICH DATA DEMO ---")
                
                # Amenities
                amenities = data.get('amenities', [])
                print(f"Amenities ({len(amenities)}):")
                for a in amenities[:5]:
                    print(f" - {a}")
                
                # Images
                images = data.get('images', [])
                print(f"\nImages ({len(images)}):")
                if images:
                    print(f" - Thumbnail: {images[0].get('thumbnail')}")
                
                # Offers
                prices = data.get('prices', [])
                print(f"\nCompetitor Offers ({len(prices)}):")
                if not prices:
                     print("No competitor list found in raw_data['prices'].")
                
                print("\n[INFO] Dumping FULL RAW DATA to inspect Room Types...")
                print(json.dumps(data, indent=2))
            else:
                print("Warning: No 'raw_data' field returned.")
        else:
            print("Error: Scan returned None (Check inputs or Quota).")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(main())
