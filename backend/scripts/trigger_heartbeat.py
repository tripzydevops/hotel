import asyncio
from backend.services.monitor_service import run_system_heartbeat, process_system_scans
from backend.utils.db import get_insforge_db

async def test_heartbeat():
    print("Initializing admin db...")
    db = get_insforge_db(admin=True)
    if not db:
        print("Failed to initialize database.")
        return
    
    print("Forcing system heartbeat...")
    # Force heartbeat flag
    db._force_heartbeat = True
    
    total_submitted = await run_system_heartbeat(db)
    print(f"Total submitted: {total_submitted}")
    
    if total_submitted:
        print("Waiting 15 seconds for tasks to complete at DataForSEO...")
        await asyncio.sleep(15)
        
        print("Processing system scans...")
        await process_system_scans(db)
        print("Processing done.")

if __name__ == "__main__":
    asyncio.run(test_heartbeat())
