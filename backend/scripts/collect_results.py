import asyncio
import os
import sys
from typing import Optional

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.services.monitor_service import process_system_scans
from backend.utils.db import get_insforge_db

async def main(specific_task_id: Optional[str] = None):
    print(f"Starting results collection for {'all pending tasks' if not specific_task_id else f'task {specific_task_id}'}...")
    
    db = get_insforge_db(admin=True)
    # Mark as admin and inject force flag to skip the 10-minute recovery delay
    db.is_admin = True
    db._force_heartbeat = True
    
    # process_system_scans will check for completed tasks and save results
    await process_system_scans(db, specific_task_id=specific_task_id)
    
    print("\nCollection cycle complete.")
    print("Checking current status of recent tasks...")
    
    tasks = db.table('scan_tasks').select('*').order('created_at', desc=True).limit(5).execute().data
    for t in tasks:
        print(f" - Task {t['id']}: Status={t['status']}, Updated={t['updated_at']}")
        if t['status'] == 'failed':
            print(f"   Error: {t.get('error_message') or t.get('error')}")
        elif t['status'] == 'completed':
            print(f"   SUCCESS: Results persisted.")

if __name__ == "__main__":
    task_id = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(main(task_id))
