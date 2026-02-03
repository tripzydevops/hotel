import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

async def test_resolution(hotel_name, location):
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        print("MISSING RAPIDAPI_KEY")
        return

    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": "booking-com15.p.rapidapi.com"
    }
    url = "https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination"
    
    queries = [
        f"{hotel_name} {location}",
        hotel_name,
        hotel_name.replace("Balikesir", "").strip()
    ]
    
    print(f"\n--- Testing: {hotel_name} ({location}) ---")
    
    async with httpx.AsyncClient() as client:
        for q in queries:
            print(f"Query: '{q}'")
            try:
                resp = await client.get(url, headers=headers, params={"query": q})
                if resp.status_code != 200:
                    print(f"Error {resp.status_code}: {resp.text}")
                    continue
                
                data = resp.json()
                results = []
                if isinstance(data, list): results = data
                elif isinstance(data, dict):
                    results = data.get("data", []) or data.get("result", [])
                
                print(f"Found {len(results)} results")
                for item in results[:3]:
                    print(f"  - [{item.get('dest_type')}] {item.get('label')} (ID: {item.get('dest_id')})")
                    if item.get('dest_type') == 'hotel':
                        print(f"  ✅ MATCH FOUND!")
                        return True
            except Exception as e:
                print(f"Exception: {e}")
    return False

async def main():
    hotels = [
        ("Hilton Garden Inn Balikesir", "Balikesir"),
        ("Ramada Residences By Wyndham Balikesir", "Balikesir"),
        ("Altın Otel & Spa Balıkesir", "Balikesir")
    ]
    
    for name, loc in hotels:
        await test_resolution(name, loc)

if __name__ == "__main__":
    asyncio.run(main())
