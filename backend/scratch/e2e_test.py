"""
End-to-end test: Post a task with hotel_identifier + proper tag, wait for it, collect results.
This tests the FULL pipeline with the fixed code.
"""
import asyncio
import os, sys
sys.path.insert(0, "/home/tripzydevops/hotel")
os.chdir("/home/tripzydevops/hotel")

from dotenv import load_dotenv
load_dotenv(".env.local")

from backend.utils.db import get_supabase
from backend.services.providers.dataforseo_provider import dataforseo_provider

async def main():
    db = get_supabase()
    
    # 1. Get a real monitored hotel with property_token
    res = db.table("user_hotels").select(
        "hotel_id, hotels(name, location, serp_api_id, property_token)"
    ).eq("is_monitored", True).limit(3).execute()
    
    if not res.data:
        print("No monitored hotels found")
        return
    
    for item in res.data:
        h = item.get("hotels", {})
        print(f"Hotel: {h.get('name')}")
        print(f"  Location: {h.get('location')}")
        print(f"  serp_api_id: {h.get('serp_api_id')}")
        print(f"  property_token: {h.get('property_token')}")
        print()
    
    # 2. Pick one with a property_token
    test_item = None
    for item in res.data:
        h = item.get("hotels", {})
        if h.get("property_token"):
            test_item = item
            break
    
    if not test_item:
        # Pick one without token to test keyword fallback
        test_item = res.data[0]
        h = test_item["hotels"]
        print(f"⚠️  No hotels with property_token! Using keyword fallback for: {h['name']}")
    else:
        h = test_item["hotels"]
        print(f"✅ Testing with property_token: {h['property_token'][:30]}...")
    
    # 3. Build task payload matching our fixed code
    from datetime import date, timedelta
    from backend.services.monitor_service import _normalize_location_for_api
    
    check_in = date.today().strftime("%Y-%m-%d")
    check_out = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
    hotel_id = test_item["hotel_id"]
    
    task_payload = {
        "location_name": _normalize_location_for_api(h["location"]),
        "language_name": "English",
        "check_in": check_in,
        "check_out": check_out,
        "adults": 2,
        "currency": "TRY",
        "tag": f"e2e_test|{hotel_id}"
    }
    
    prop_token = h.get("property_token")
    if prop_token:
        task_payload["hotel_identifier"] = prop_token
    else:
        task_payload["keyword"] = h["name"]
    
    print(f"\nPosting task: {task_payload}")
    
    # 4. Post task
    task_ids = await dataforseo_provider.post_price_tasks([task_payload])
    if not task_ids:
        print("❌ TASK REJECTED!")
        return
    
    print(f"✅ Task accepted: {task_ids[0]}")
    
    # 5. Wait for completion
    print("\nWaiting for task to complete...")
    for attempt in range(30):
        await asyncio.sleep(10)
        completed = await dataforseo_provider.get_completed_tasks()
        
        # Check if our task is in the completed list
        if task_ids[0] in completed:
            print(f"✅ Task completed after {(attempt+1)*10}s")
            
            # 6. Fetch results
            result = await dataforseo_provider.fetch_task_results(task_ids[0])
            print(f"\nResult status: {result.get('status')}")
            print(f"Tag: {result.get('tag')}")
            print(f"Price: {result.get('price')} {result.get('currency')}")
            print(f"Hotel: {result.get('hotel_name')}")
            print(f"Rating: {result.get('rating')} ({result.get('reviews')} reviews)")
            print(f"Items count: {len(result.get('items', []))}")
            
            # Check tag parsing
            tag = result.get("tag", "")
            if tag and "|" in tag:
                sess_id, h_id = tag.split("|", 1)
                print(f"\n✅ Tag parsed correctly:")
                print(f"  Session: {sess_id}")
                print(f"  Hotel ID: {h_id}")
            elif tag:
                print(f"\n⚠️ Tag present but no pipe: '{tag}'")
            else:
                print(f"\n❌ TAG IS NONE - this is why process_system_scans skips results!")
            
            return
        
        print(f"  Poll {attempt+1}/30: {len(completed)} tasks ready, ours not yet...")
    
    print("Timeout - task didn't complete in 5 minutes")

asyncio.run(main())
