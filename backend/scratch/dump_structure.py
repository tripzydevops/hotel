"""
Fetch a real task and dump the full structure to understand response format.
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
        # Get a ready task
        resp = await client.get(f"{API_URL}/business_data/google/hotel_searches/tasks_ready")
        data = resp.json()
        
        for wrapper in data.get("tasks", []):
            results = wrapper.get("result")
            if results:
                task_id = results[0].get("id")
                tag = results[0].get("tag", "")
                print(f"Task: {task_id} (tag: {tag})")
                
                # Fetch with correct endpoint
                resp2 = await client.get(
                    f"{API_URL}/business_data/google/hotel_searches/task_get/{task_id}"
                )
                data2 = resp2.json()
                
                task = data2["tasks"][0]
                result = task.get("result", [])
                
                if result:
                    r = result[0]
                    items = r.get("items", [])
                    print(f"\nResult keys: {list(r.keys())}")
                    print(f"Items: {len(items)}")
                    
                    if items:
                        item = items[0]
                        print(f"\nItem keys: {list(item.keys())}")
                        print(f"Item type: {item.get('type')}")
                        print(f"Title: {item.get('title')}")
                        print(f"Price: {item.get('price')}")
                        print(f"Currency: {item.get('currency')}")
                        print(f"Hotel ID: {item.get('hotel_identifier')}")
                        
                        prices = item.get("prices")
                        if prices:
                            print(f"\nPrices ({len(prices)}):")
                            for p in prices[:5]:
                                print(f"  {p.get('source', '?')}: {p.get('price', '?')} {p.get('currency', '')}")
                                print(f"    Keys: {list(p.keys())}")
                        
                        vendors = item.get("vendors")
                        if vendors:
                            print(f"\nVendors ({len(vendors)}):")
                            for v in vendors[:3]:
                                print(f"  {json.dumps(v, default=str)[:200]}")
                        
                        rating = item.get("rating")
                        if rating:
                            print(f"\nRating: {json.dumps(rating, default=str)}")
                    
                    print(f"\nTag from task: {task.get('tag')}")
                
                return

asyncio.run(main())
