"""
Raw diagnostic: See exactly what DataForSEO is returning.
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
        # Step 1: What tasks are "ready"?
        print("=" * 60)
        print("STEP 1: tasks_ready endpoint")
        print("=" * 60)
        resp = await client.get(f"{API_URL}/business_data/google/hotel_searches/tasks_ready")
        data = resp.json()
        print(f"Status: {data.get('status_code')} - {data.get('status_message')}")
        print(f"Tasks count: {data.get('tasks_count')}")
        
        tasks = data.get("tasks", [])
        if not tasks:
            print("NO TASKS RETURNED AT ALL.")
            return
        
        # Show the raw structure of tasks_ready
        for i, task in enumerate(tasks):
            print(f"\n--- Task wrapper [{i}] ---")
            print(f"  id: {task.get('id')}")
            print(f"  status_code: {task.get('status_code')}")
            print(f"  status_message: {task.get('status_message')}")
            
            # KEY: Check if there are nested results with the REAL task IDs
            result = task.get("result")
            if result:
                print(f"  result count: {len(result)}")
                for j, r in enumerate(result[:3]):
                    print(f"    result[{j}].id = {r.get('id')}")
                    print(f"    result[{j}].tag = {r.get('tag')}")
                    print(f"    result[{j}].endpoint = {r.get('endpoint_advanced')}")
            else:
                print(f"  result: {result}")
        
        # Step 2: Try fetching with the WRAPPER task ID (what the code currently does)
        wrapper_id = tasks[0].get("id")
        print(f"\n{'=' * 60}")
        print(f"STEP 2: Fetching with WRAPPER ID: {wrapper_id}")
        print(f"{'=' * 60}")
        
        resp2 = await client.get(f"{API_URL}/business_data/google/hotel_searches/task_get/advanced/{wrapper_id}")
        data2 = resp2.json()
        print(f"Status: {data2.get('status_code')} - {data2.get('status_message')}")
        if data2.get("tasks"):
            t = data2["tasks"][0]
            print(f"  task status: {t.get('status_code')} - {t.get('status_message')}")
            print(f"  task result: {'YES' if t.get('result') else 'NO/NULL'}")
            if t.get("result"):
                print(f"  result[0] keys: {list(t['result'][0].keys())[:10]}")
                items = t["result"][0].get("items")
                if items:
                    print(f"  items count: {len(items)}")
                    print(f"  items[0] keys: {list(items[0].keys())[:15]}")
                    print(f"  items[0] price: {items[0].get('price')}")
                else:
                    print(f"  items: {items}")
        
        # Step 3: If tasks_ready has nested result IDs, try fetching with the REAL task ID
        if tasks[0].get("result"):
            real_id = tasks[0]["result"][0].get("id")
            if real_id and real_id != wrapper_id:
                print(f"\n{'=' * 60}")
                print(f"STEP 3: Fetching with REAL/NESTED ID: {real_id}")
                print(f"{'=' * 60}")
                
                resp3 = await client.get(f"{API_URL}/business_data/google/hotel_searches/task_get/advanced/{real_id}")
                data3 = resp3.json()
                print(f"Status: {data3.get('status_code')} - {data3.get('status_message')}")
                if data3.get("tasks"):
                    t3 = data3["tasks"][0]
                    print(f"  task status: {t3.get('status_code')} - {t3.get('status_message')}")
                    print(f"  task result: {'YES' if t3.get('result') else 'NO/NULL'}")
                    if t3.get("result"):
                        print(f"  result keys: {list(t3['result'][0].keys())[:10]}")
                        items3 = t3["result"][0].get("items")
                        if items3:
                            print(f"  items count: {len(items3)}")
                            first = items3[0]
                            print(f"  items[0] type: {first.get('type')}")
                            print(f"  items[0] price: {first.get('price')}")
                            print(f"  items[0] hotel_name: {first.get('hotel_name')}")
                            print(f"  items[0] keys: {list(first.keys())[:20]}")
            else:
                print(f"\nWrapper ID and nested ID are the same: {wrapper_id}")

asyncio.run(main())
