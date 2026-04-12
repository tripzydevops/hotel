import asyncio
import os
from datetime import datetime, timezone
from backend.utils.db import get_supabase
from backend.services.monitor_service import run_system_heartbeat, process_system_scans

async def main():
    db = get_supabase(admin=True)
    
    print("Step 1: Forcing System Heartbeat...")
    # Bypass timing check using the force flag I saw in the code
    setattr(db, "_force_heartbeat", True)
    await run_system_heartbeat(db)
    
    print("Step 2: Heartbeat triggered. Waiting for DataForSEO to process (120s)...")
    await asyncio.sleep(120)
    
    print("Step 3: Running Task Processor to collect results...")
    await process_system_scans(db)
    print("Done. Check price_logs table.")

if __name__ == "__main__":
    asyncio.run(main())
