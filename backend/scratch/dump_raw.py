"""
Dump full raw item structure to understand field mapping.
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
        resp = await client.get(f"{API_URL}/business_data/google/hotel_searches/tasks_ready")
        data = resp.json()
        
        for wrapper in data.get("tasks", []):
            results = wrapper.get("result")
            if results:
                task_id = results[0].get("id")
                tag = results[0].get("tag", "")
                
                resp2 = await client.get(
                    f"{API_URL}/business_data/google/hotel_searches/task_get/{task_id}"
                )
                data2 = resp2.json()
                
                task = data2["tasks"][0]
                result = task.get("result", [])
                
                if result:
                    items = result[0].get("items", [])
                    if items:
                        # Dump first item completely
                        print("=== FIRST ITEM (full JSON) ===")
                        print(json.dumps(items[0], indent=2, default=str)[:3000])
                        
                        print("\n=== TAG ===")
                        print(f"Tag: {task.get('tag')}")
                
                return

asyncio.run(main())
