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

# Ensure project root is in sys.path
root_dir = r"C:\projects\hotelplus-vm"
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.utils.db import load_env_standard
load_env_standard()

from backend.services.monitor_service import run_scheduler_check_logic

async def main():
    print("=" * 70)
    print(">>> INITIATING GLOBAL HOTEL SCAN NOW <<<")
    print("=" * 70)
    try:
        await run_scheduler_check_logic()
        print("\n" + "=" * 70)
        print(">>> GLOBAL HOTEL SCAN TRIGGER COMPLETED SUCCESSFULLY <<<")
        print("=" * 70)
    except Exception as e:
        import traceback
        print(f"\n[CRITICAL ERROR] Scan execution failed: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
