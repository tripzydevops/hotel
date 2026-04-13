import asyncio
import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase
from backend.services.monitor_service import run_system_heartbeat, get_scheduler_logger

async def force_sync():
    logger = get_scheduler_logger()
    logger.info("=== FORCING SYSTEM HEARTBEAT ===")
    
    db = get_supabase(admin=True)
    if not db:
        logger.error("Could not connect to database")
        return

    # Monkey patch to bypass timing check
    db._force_heartbeat = True
    
    await run_system_heartbeat(db)
    logger.info("Heartbeat execution complete.")
    logger.info("=== FORCE SYNC COMPLETED ===")

if __name__ == "__main__":
    asyncio.run(force_sync())
