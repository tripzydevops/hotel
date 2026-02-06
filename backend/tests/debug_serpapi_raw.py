import asyncio
import os
import httpx
import json
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

async def debug_serpapi():
    print("--- Debugging SerpApi Raw JSON ---")
    
    # Load keys
    keys = []
    primary = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
    if primary: keys.append(primary)
    
    if not keys:
        print("No SERPAPI_KEY found.")
        return

    check_in = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
    check_out = (date.today() + timedelta(days=31)).strftime("%Y-%m-%d")
    query = "Hilton Garden Inn Balikesir"
    
    params = {
        "engine": "google_hotels",
        "q": query,
        "check_in_date": check_in,
        "check_out_date": check_out,
        "adults": 2,
        "currency": "USD",
        "gl": "tr",
        "hl": "en",
        "api_key": keys[0]
    }
    
    async with httpx.AsyncClient() as client:
        print(f"Querying SerpApi: {query}")
        resp = await client.get("https://serpapi.com/search", params=params)
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        # Dump to file
        with open("serpapi_debug.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            
        print("Saved raw response to serpapi_debug.json")
        
        # Quick inspection
        print(f"Properties found: {len(data.get('properties', []))}")
        if data.get("error"):
            print(f"Error: {data.get('error')}")

if __name__ == "__main__":
    asyncio.run(debug_serpapi())
