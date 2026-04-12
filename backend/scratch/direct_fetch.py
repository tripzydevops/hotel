"""
Direct fetch - bypass tasks_ready and just hit task_get directly with our posted ID.
"""
import asyncio
import httpx
import json

LOGIN = "successofmentors@gmail.com"
PASSWORD = "d276748f9354ec68"
API_URL = "https://api.dataforseo.com/v3"

async def main():
    auth = (LOGIN, PASSWORD)
    
    # Task ID from the post we just did
    task_id = "04112310-1419-0290-0000-ee6a744ae108"
    
    async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
        print(f"Direct fetch of task: {task_id}")
        resp = await client.get(
            f"{API_URL}/business_data/google/hotel_searches/task_get/advanced/{task_id}"
        )
        data = resp.json()
        print(f"Status: {data.get('status_code')} - {data.get('status_message')}")
        
        if data.get("tasks"):
            task = data["tasks"][0]
            print(f"Task status: {task.get('status_code')} - {task.get('status_message')}")
            
            if task.get("result"):
                result = task["result"][0]
                items = result.get("items", [])
                print(f"Items count: {len(items)}")
                if items:
                    first = items[0]
                    print(f"  type: {first.get('type')}")
                    print(f"  price: {first.get('price')}")
                    print(f"  currency: {first.get('currency')}")
                    print(f"  hotel_name: {first.get('hotel_name')}")
                    print(f"  tag: {task.get('tag')}")
                    print(f"  keys: {list(first.keys())[:20]}")
                else:
                    print("Items is empty")
                    print(json.dumps(result, indent=2, default=str)[:1000])
            else:
                print(f"No result yet. Task may still be processing.")
                print(f"Full task: {json.dumps(task, indent=2, default=str)[:1000]}")

asyncio.run(main())
