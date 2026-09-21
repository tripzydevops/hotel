import asyncio
import logging
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

root_dir = r"C:\projects\hotelplus-vm"
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.utils.db import get_insforge_db, load_env_standard
load_env_standard()

from backend.services.monitor_service import run_system_heartbeat, process_system_scans

async def main():
    print("=" * 70)
    print(">>> 1. SUBMITTING FRESH LIVE GLOBAL HOTEL SCAN <<<")
    print("=" * 70)
    
    db = get_insforge_db(admin=True)
    setattr(db, "_force_heartbeat", True)
    
    # 1. Dispatch heartbeat scan
    session_id = await run_system_heartbeat(db)
    print(f"Scan dispatched for session: {session_id}")
    
    # 2. Wait 15 seconds for DataForSEO to complete tasks
    print("\nWaiting 15 seconds for DataForSEO processing...")
    await asyncio.sleep(15)
    
    # 3. Process completed tasks and persist
    print("\n" + "=" * 70)
    print(">>> 2. FETCHING & PERSISTING COMPLETE RESULTS (PRICE_LOGS, OTAs, REVIEWS) <<<")
    print("=" * 70)
    await process_system_scans(db)
    
    print("\n" + "=" * 70)
    print(">>> SCAN & PERSISTENCE FULL PIPELINE FINISHED <<<")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
