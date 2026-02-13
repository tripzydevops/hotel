
import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv(".env.local")

async def test_hilton():
    api_key = os.getenv("SERPAPI_API_KEY")
    # Hilton Garden Inn Balikesir ID from DB
    serp_id = "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE"
    
    params = {
        "engine": "google_hotels",
        "q": "Balikesir Hotels",
        # "property_token": serp_id, 
        "check_in_date": "2026-02-13",
        "check_out_date": "2026-02-14",
        "adults": 2,
        "currency": "TRY",
        "gl": "tr",
        "hl": "tr",
        "api_key": api_key
    }
    
    url = "https://serpapi.com/search"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        data = response.json()
        
        print(f"Status Code: {response.status_code}")
        
        # Check properties
        props = data.get("properties", [])
        print(f"Total properties found: {len(props)}")
        for i, p in enumerate(props):
            print(f"{i+1}. {p.get('name')} - {p.get('rate_per_night')}")
        
        if props:
            p = props[0]
            # print(f"Found Name: {p.get('name')}")
            # print(f"Found Price: {p.get('rate_per_night')}")
            print(f"Featured Prices: {p.get('featured_prices')}")
            
        # Check Knowledge Graph
        if "rate_per_night" in data:
            print(f"Knowledge Graph Price: {data.get('rate_per_night')}")
        
        # Check if hl=tr worked
        if props:
            print(f"Room name example: {props[0].get('rooms', [{}])[0].get('name')}")

if __name__ == "__main__":
    asyncio.run(test_hilton())
