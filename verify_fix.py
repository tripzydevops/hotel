
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

# Set PYTHONPATH to include the current directory
import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.services.monitor_service import run_scheduler_check_logic

async def main():
    print("Starting verification scan...")
    await run_scheduler_check_logic()
    print("Verification scan complete.")

if __name__ == "__main__":
    asyncio.run(main())
