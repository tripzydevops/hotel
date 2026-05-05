import asyncio
import os
import sys
from datetime import datetime

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.services.monitor_service import run_system_heartbeat
from backend.utils.db import get_insforge_db

async def check_monitored_hotels():
    print("Checking for monitored hotels via user_hotels...")
    db = get_insforge_db(admin=True)
    res = (
        db.table("user_hotels")
        .select("hotel_id, is_monitored, hotels(id, name, property_token, serp_api_id)")
        .eq("is_monitored", True)
        .execute()
    )
    
    entries = res.data
    valid_hotels = []
    seen_ids = set()
    for entry in entries:
        h = entry.get('hotels')
        if h and (h.get('property_token') or h.get('serp_api_id')):
            if h['id'] not in seen_ids:
                valid_hotels.append(h)
                seen_ids.add(h['id'])
    
    print(f"Total monitored entries in user_hotels: {len(entries)}")
    print(f"Unique hotels with tokens/IDs: {len(valid_hotels)}")
    
    for h in valid_hotels:
        print(f" - {h['name']} (ID: {h['id']}, Token: {h.get('property_token')}, SERP ID: {h.get('serpapi_id')})")
    
    return valid_hotels

async def main():
    valid_hotels = await check_monitored_hotels()
    if not valid_hotels:
        print("No valid hotels found for heartbeat. Aborting.")
        return

    print("\nTriggering system heartbeat (FORCED)...")
    
    db = get_insforge_db(admin=True)
    # Inject force flag
    db._force_heartbeat = True
    # Mark as admin for logging purposes
    db.is_admin = True
    
    session_id = await run_system_heartbeat(db)
    
    if session_id:
        print(f"Heartbeat triggered successfully. Session ID: {session_id}")
        
        print("Waiting 15 seconds for tasks to be registered in DB...")
        await asyncio.sleep(15)
        
        tasks_res = db.table("scan_tasks").select("*").eq("session_id", session_id).execute()
        tasks = tasks_res.data
        print(f"Created {len(tasks)} tasks:")
        for t in tasks:
            print(f" - Task {t['id']}: Status={t['status']}, Type={t['task_type']}, Provider ID={t['provider_task_id']}")
            
        print("\nSUCCESS: Heartbeat initiated.")
        print("NEXT STEP: Wait 5-10 minutes, then run 'process_system_scans' to collect results.")
    else:
        print("Heartbeat did not create a session. Check scheduler.log for details.")
        log_path = os.path.join(project_root, "scheduler.log")
        if os.path.exists(log_path):
            print("\nRecent entries in scheduler.log:")
            with open(log_path, 'r') as f:
                lines = f.readlines()
                for line in lines[-20:]:
                    print(line.strip())

if __name__ == "__main__":
    asyncio.run(main())
