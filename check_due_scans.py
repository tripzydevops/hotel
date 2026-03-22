import asyncio
import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv

# EXPLANATION: Path Injection
# Ensures the script can resolve backend modules regardless of execution context.
sys.path.append(os.getcwd())

load_dotenv()

from backend.services.monitor_service import run_scheduler_check_logic
from backend.utils.logger import get_logger

logger = get_logger("scheduler_worker")

async def main_loop():
    """
    Persistent execution loop for the Hotel Price Monitor.
    Designed to run under PM2 for 24/7 reliability.
    """
    logger.info("=== HOTEL SCHEDULER WORKER STARTED ===")
    
    # 1. Initial Delay to ensure DB and Network are ready on system boot
    time.sleep(2)
    
    while True:
        start_time = time.time()
        try:
            # 2. Execute the Core Scheduler Logic
            # This handles: Zombie cleanup, Market Sync (Turkey Pulse), 
            # and dispatching due scans via ScraperAgent.
            await run_scheduler_check_logic()
            
        except Exception as e:
            logger.error(f"Worker Loop Exception: {e}")
            # exponential backoff on fatal loop errors to prevent API spamming
            time.sleep(10)
            
        # Default: Check every 60 seconds.
        # Calculation ensures the 60s is inclusive of the processing time (Anti-Drift).
        elapsed = time.time() - start_time
        sleep_time = max(10, int(60 - elapsed))
        
        logger.info(f"Cycle complete ({elapsed:.2f}s). Sleeping for {sleep_time}s...")
        await asyncio.sleep(sleep_time)

if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")
    except Exception as fatal:
        logger.critical(f"FATAL WORKER EXIT: {fatal}")
