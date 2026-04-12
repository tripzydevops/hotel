"""
Check post_price_tasks response format. Maybe the ID returned by task_post
isn't actually the task ID we should use for fetching.
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
        # Post a minimal task and dump the FULL response
        post_data = [{
            "keyword": "Hilton Istanbul Bomonti",
            "location_name": "Istanbul,Turkey",
            "check_in": "2026-04-12",
            "check_out": "2026-04-13",
            "adults": 2,
            "currency": "TRY",
            "tag": "debug_test"
        }]
        
        resp = await client.post(
            f"{API_URL}/business_data/google/hotel_searches/task_post",
            json=post_data
        )
        data = resp.json()
        print("FULL TASK_POST RESPONSE:")
        print(json.dumps(data, indent=2, default=str)[:3000])

asyncio.run(main())
