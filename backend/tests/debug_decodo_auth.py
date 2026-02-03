import asyncio
import os
import httpx
from dotenv import load_dotenv
import base64

load_dotenv()
load_dotenv(".env.local", override=True)

async def debug_decodo():
    print("--- Debugging Decodo Auth ---")
    
    api_key = os.getenv("DECODO_API_KEY")
    if not api_key:
        print("No DECODO_API_KEY found.")
        return
        
    print(f"API Key found (length {len(api_key)})")
    
    # Decodo requires Basic Auth with User=API_KEY, Pass=""
    # requests/httpx auth=('user', 'pass') does this automatically.
    
    url = "https://scraper-api.decodo.com/v2/task"
    
    # Try 1: Explicit Basic Header
    print("\nAttempt 1: Explicit Basic Header")
    user_pass = f"{api_key}:"
    encoded = base64.b64encode(user_pass.encode()).decode()
    headers = {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json"
    }
    
    # Minimal payload
    payload = {
        "target": "google_search",
        "query": "test",
        "geo": "United States"
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")

    # Try 2: httpx auth parameter
    # Try 3: Bearer Token
    print("\nAttempt 3: Bearer Token")
    headers_bearer = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers_bearer, json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")

    # Try 4: Query Param (token)
    print("\nAttempt 4: Query Param (token)")
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{url}?token={api_key}", json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
        
    # Try 5: X-API-KEY header
    print("\nAttempt 5: X-API-KEY")
    headers_x = {"X-API-KEY": api_key}
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers_x, json=payload)
        print(f"Status: {resp.status_code}")

if __name__ == "__main__":
    asyncio.run(debug_decodo())
