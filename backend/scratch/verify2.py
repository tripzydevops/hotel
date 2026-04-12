"""
Verify pipeline - fetch data from a ready task.
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
        # Get ready tasks
        resp = await client.get(f"{API_URL}/business_data/google/hotel_searches/tasks_ready")
        data = resp.json()
        
        ready_ids = []
        for wrapper in data.get("tasks", []):
            results = wrapper.get("result")
            if results:
                for item in results:
                    tid = item.get("id")
                    if tid:
                        ready_ids.append(tid)
        
        print(f"Found {len(ready_ids)} ready tasks")
        
        # Fetch each one until we get data
        for rid in ready_ids[:3]:
            print(f"\nFetching: {rid}")
            resp2 = await client.get(
                f"{API_URL}/business_data/google/hotel_searches/task_get/advanced/{rid}"
            )
            data2 = resp2.json()
            print(f"  Status: {data2.get('status_code')} - {data2.get('status_message')}")
            
            tasks = data2.get("tasks")
            if not tasks:
                print(f"  No tasks in response")
                continue
                
            task = tasks[0]
            print(f"  Task status: {task.get('status_code')} - {task.get('status_message')}")
            
            result = task.get("result")
            if not result:
                print(f"  No result")
                continue
            
            items = result[0].get("items", [])
            print(f"  Items: {len(items)}")
            tag = result[0].get("tag", "")
            print(f"  Tag: {tag}")
            
            for item in items[:5]:
                t = item.get("type", "")
                if t == "google_hotels_hotel_element":
                    print(f"\n  🏨 {item.get('title', 'N/A')}")
                    prices = item.get("prices", [])
                    for p in prices[:3]:
                        print(f"     {p.get('source', '?')}: {p.get('price', '?')} {p.get('currency', '')}")
            
            print(f"\n✅ PIPELINE WORKING!")
            return
        
        print("No fetchable tasks found")

asyncio.run(main())
