import os
import sys
import asyncio
import json
import httpx
from datetime import date, timedelta
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)


async def check_raw_response():
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        print("Error: SERPAPI_API_KEY not found.")
        return

    print("Fetching raw data via HTTP...")
    today = date.today()
    in_date = (today + timedelta(days=30)).isoformat()
    out_date = (today + timedelta(days=31)).isoformat()

    params = {
        "engine": "google_hotels",
        "q": "Istanbul hotels",
        "check_in_date": in_date,
        "check_out_date": out_date,
        "adults": "2",
        "currency": "USD",
        "gl": "tr",
        "hl": "en",
        "api_key": api_key
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://serpapi.com/search", params=params)
        data = resp.json()
        
        properties = data.get("properties", [])
        if properties:
            first = properties[0]
            print(json.dumps(first, indent=2))
            
            if "gps_coordinates" in first:
                print(f"\nFOUND 'gps_coordinates': {first['gps_coordinates']}")
            elif "latitude" in first:
                print(f"\nFOUND 'latitude': {first['latitude']}")
            else:
                print("\nNO coordinates found in 'properties' object.")
        else:
            print("No properties found.")

if __name__ == "__main__":
    asyncio.run(check_raw_response())
