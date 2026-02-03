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
    query = f"Willmont Hotel Balikesir price {check_in} to {check_out}"
    
    payload = {
        "q": query,
        "gl": "tr", 
        "hl": "en",
    }
    
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }

    # Try Shopping
    print("Trying https://google.serper.dev/shopping ...")
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://google.serper.dev/shopping", headers=headers, json=payload)
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        # Dump to file for easier reading
        with open("serper_debug.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            
        print("Saved raw response to serper_debug.json")
        
        # Print key sections
        if "knowledgeGraph" in data:
            print("Knowledge Graph found!")
            print(json.dumps(data["knowledgeGraph"], indent=2))
            
        if "organic" in data:
            print(f"Organic Results: {len(data['organic'])}")
            print(data['organic'][0].get("snippet"))

if __name__ == "__main__":
    asyncio.run(debug_serper())
