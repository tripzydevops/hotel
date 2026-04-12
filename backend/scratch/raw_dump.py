"""
Dump the FULL raw JSON from tasks_ready to understand the structure.
"""
import asyncio
import httpx
import json

LOGIN = "successofmentors@gmail.com"
PASSWORD = "d276748f9354ec68"
API_URL = "https://api.dataforseo.com/v3"

async def main():
    auth = (LOGIN, PASSWORD)
    
    async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
        # Full dump of tasks_ready
        resp = await client.get(f"{API_URL}/business_data/google/hotel_searches/tasks_ready")
        data = resp.json()
        
        # Pretty-print the entire response
        print(json.dumps(data, indent=2, default=str)[:5000])

asyncio.run(main())
