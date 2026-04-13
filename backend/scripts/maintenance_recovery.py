import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta

# Add the project root to sys.path
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase
from backend.services.monitor_service import run_scheduler_check_logic, get_scheduler_logger

async def recover():
    logger = get_scheduler_logger()
    logger.info("=== STARTING SYSTEM RECOVERY ===")
    
    db = get_supabase(admin=True)
    if not db:
        logger.error("Could not connect to database")
        return

    # 1. Manual Zombie Cleanup (just in case the cron interval hasn't reached it)
    logger.info("Step 1: Checking for zombie sessions...")
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    zombies = (
        db.table("scan_sessions")
        .select("id, status, created_at")
        .in_("status", ["pending", "running", "processing"])
        .lt("created_at", cutoff)
        .execute()
    )

    if zombies.data:
        z_ids = [z["id"] for z in zombies.data]
        logger.warning(f"Found {len(z_ids)} zombie sessions: {z_ids}")
        db.table("scan_sessions").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).in_("id", z_ids).execute()
        logger.info("Zombie sessions marked as failed.")
    else:
        logger.info("No zombies found (cutoff: 2 hours).")

    # 2. Trigger Scheduler Logic
    logger.info("Step 2: Triggering scheduler resumption...")
    await run_scheduler_check_logic()
    logger.info("Scheduler logic executed.")

    # 3. Final Verification of Admin Settings
    settings = db.table("admin_settings").select("*").limit(1).execute()
    if settings.data:
        s = settings.data[0]
        logger.info(f"System Pulse Status:")
        logger.info(f" - Last Global Scan: {s.get('last_global_scan_at')}")
        logger.info(f" - Next Global Scan: {s.get('next_global_scan_at')}")

    logger.info("=== RECOVERY COMPLETED ===")

if __name__ == "__main__":
    asyncio.run(recover())
