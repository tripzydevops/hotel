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

    # Try Reviews with CID (from previous Places result)
    # CID for Hilton Garden Inn Balikesir: "3233374916735990197"
    
    print("\n--- Testing Query (Reviews with CID) ---")
    payload = {
        "cid": "3233374916735990197",
        "gl": "tr", 
        "hl": "en"
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://google.serper.dev/reviews", headers=headers, json=payload)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            with open("serper_reviews_debug.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                
            print(f"Keys available: {list(data.keys())}")
            reviews = data.get("reviews", [])
            print(f"Reviews found: {len(reviews)}")
            if reviews:
                 print(f"First Review Snippet: {json.dumps(reviews[0], indent=2)}")
        else:
            print(f"Error: {resp.text}")

if __name__ == "__main__":
    asyncio.run(debug_serper())
