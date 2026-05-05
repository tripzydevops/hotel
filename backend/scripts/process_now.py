import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from backend.utils.db import get_insforge_db
from backend.services.monitor_service import process_system_scans

async def run_processing():
    db = get_insforge_db(admin=True)
    if not db:
        print("Error: Database client not available")
        return

    # Find the latest pending tasks
    pending_res = (
        db.table("scan_tasks")
        .select("external_task_id")
        .eq("status", "pending")
        .not_.is_("external_task_id", "null")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    if not pending_res.data:
        print("No pending tasks found.")
        return

    task_ids = [t["external_task_id"] for t in pending_res.data]
    print(f"Found {len(task_ids)} pending tasks. Processing them individually...")

    for tid in task_ids:
        print(f"Processing task {tid}...")
        await process_system_scans(db, specific_task_id=tid)
    
    print("Done!")

if __name__ == "__main__":
    asyncio.run(run_processing())
