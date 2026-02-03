import os
import asyncio
import httpx
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

API_KEY = os.getenv("RAPIDAPI_KEY")
HOST = "booking-com15.p.rapidapi.com"

async def debug_prices():
    headers = {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": HOST
    }
    
    # 1. Resolve Hilton
    print("Resolving Hilton Garden Inn Balikesir...")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://{HOST}/api/v1/hotels/searchDestination",
            headers=headers,
            params={"query": "Hilton Garden Inn Balikesir"}
        )
        dest_id = resp.json()["data"][0]["dest_id"]
        print(f"Dest ID: {dest_id}")

        # 2. Get Prices
        print("Fetching Prices...")
        params = {
            "dest_id": dest_id,
            "search_type": "hotel",
            "arrival_date": date.today().strftime("%Y-%m-%d"),
            "departure_date": (date.today() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "adults": "2",
            "currency_code": "TRY"
        }
        resp = await client.get(
            f"https://{HOST}/api/v1/hotels/searchHotels",
            headers=headers,
            params=params
        )
        data = resp.json()
        
        hotels = data.get("data", {}).get("hotels", [])
        if not hotels:
            print("No hotels found!")
            return

        prop = hotels[0].get("property", hotels[0])
        print(f"\n--- {prop.get('name')} ---")
        print(f"Price Breakdown: {json.dumps(prop.get('priceBreakdown'), indent=2)}")
        
        # Check for other price fields
        print(f"Gross Price: {prop.get('priceBreakdown', {}).get('grossPrice')}")
        print(f"Strikethrough Price: {prop.get('priceBreakdown', {}).get('strikethroughPrice')}")
        
        # Altın Otel Check
        print("\nResolving Altın Otel & Spa Balıkesir...")
        resp = await client.get(
            f"https://{HOST}/api/v1/hotels/searchDestination",
            headers=headers,
            params={"query": "Altın Otel & Spa Balıkesir"}
        )
        dest_id = resp.json()["data"][0]["dest_id"]
        params["dest_id"] = dest_id
        resp = await client.get(
            f"https://{HOST}/api/v1/hotels/searchHotels",
            headers=headers,
            params=params
        )
        data = resp.json()
        prop = data["data"]["hotels"][0].get("property", data["data"]["hotels"][0])
        print(f"\n--- {prop.get('name')} ---")
        print(f"Price Breakdown: {json.dumps(prop.get('priceBreakdown'), indent=2)}")

if __name__ == "__main__":
    import json
    asyncio.run(debug_prices())
