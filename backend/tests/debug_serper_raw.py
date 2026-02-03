import asyncio
import os
import httpx
import json
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

async def debug_serper():
    print("--- Debugging Serper Raw JSON ---")
    
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        print("No SERPER_API_KEY found.")
        return

    # More specific query with dates
    check_in = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
    check_out = (date.today() + timedelta(days=31)).strftime("%Y-%m-%d")
    # Variations to test
    variations = [
        f"Hilton Garden Inn Balikesir booking {check_in} {check_out}",
        f"hotel Hilton Garden Inn Balikesir",
        f"Hilton Garden Inn Balikesir gecelik fiyat", # Turkish intent
    ]
    
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }

    # Try Places
    variations = [
        "Hilton Garden Inn Balikesir",
    ]
    
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        for q in variations:
            print(f"\n--- Testing Query (Places): {q} ---")
            payload = {
                "q": q,
                "gl": "tr", 
                "hl": "en",
                "type": "places"
            }
            resp = await client.post("https://google.serper.dev/places", headers=headers, json=payload)
            print(f"Status: {resp.status_code}")
            data = resp.json()
            
            with open("serper_places_debug.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                
            places = data.get("places", [])
            print(f"Results found: {len(places)}")
            if places:
                print(f"Top Result: {places[0].get('title')} - {places[0].get('rating')}")
                print(f"Details: {json.dumps(places[0], indent=2)}")

if __name__ == "__main__":
    asyncio.run(debug_serper())
