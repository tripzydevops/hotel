
import os
import httpx
import asyncio
import json
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

async def debug_serpapi():
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        print("No API Key")
        return

    params = {
        "engine": "google_hotels",
        "q": "The Marmara Taksim",
        "check_in_date": "2026-02-10",
        "check_out_date": "2026-02-11",
        "api_key": api_key,
        "currency": "TRY",
        "hl": "tr",
        "gl": "tr"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get("https://serpapi.com/search", params=params)
        data = response.json()
        
        # Save to file for inspection
        with open("serpapi_debug.json", "w") as f:
            json.dump(data, f, indent=2)
            
        print("Keys at root:", list(data.keys()))
        if "rooms" in data:
            print("Found 'rooms' at root")
        if "properties" in data and data["properties"]:
            print("Found 'properties' list")
            p = data["properties"][0]
            print("Keys in first property:", list(p.keys()))
            if "rooms" in p:
                print("Found 'rooms' in property")
            if "room_types" in p:
                print("Found 'room_types' in property")

if __name__ == "__main__":
    asyncio.run(debug_serpapi())
