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

from backend.services.monitor_service import process_system_scans

async def main():
    print("=" * 70)
    print(">>> PROCESSING PENDING SCAN TASKS FROM DATAFORSEO <<<")
    print("=" * 70)
    
    insforge = get_insforge_db(admin=True)
    # Set _force_heartbeat to True to bypass the 10-minute age cutoff
    setattr(insforge, "_force_heartbeat", True)
    
    await process_system_scans(insforge)
    
    print("\n" + "=" * 70)
    print(">>> TASK PROCESSING COMPLETE <<<")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
