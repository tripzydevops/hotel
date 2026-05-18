import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

# Add project root to sys.path
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase

async def inspect():
    s = get_supabase(admin=True)
    if not s:
        print("Failed to connect to database.")
        return
        
    print("Fetching today's scan tasks...")
    # Today starting from UTC midnight
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Query scan_tasks table
    res = s.table('scan_tasks').select('*').gte('created_at', today_start.isoformat()).execute()
    tasks = res.data or []
    
    print(f"Total tasks created today: {len(tasks)}")
    if not tasks:
        # Let's get the latest 20 tasks instead if nothing was created today
        print("No tasks created today. Fetching the latest 20 tasks...")
        res = s.table('scan_tasks').select('*').order('created_at', desc=True).limit(20).execute()
        tasks = res.data or []
        print(f"Total latest tasks: {len(tasks)}")

    # Group tasks by status, task_type and errors
    summary = {}
    for task in tasks:
        status = task.get('status', 'unknown')
        tt = task.get('task_type', 'unknown')
        err = task.get('error_message') or task.get('error') or 'None'
        
        key = (status, tt, err)
        summary[key] = summary.get(key, 0) + 1

    print("\n=== Tasks Summary ===")
    for (status, tt, err), count in sorted(summary.items(), key=lambda x: x[1], reverse=True):
        print(f"Count: {count:3d} | Status: {status:10s} | Type: {tt:10s} | Error: {err}")

    print("\n=== Detail of Failed/Pending Tasks ===")
    count = 0
    for task in sorted(tasks, key=lambda x: x.get('created_at', ''), reverse=True):
        status = task.get('status', 'unknown')
        if status != 'completed' and count < 15:
            print(f"ID: {task['id']}")
            print(f"  External ID: {task.get('external_task_id')}")
            print(f"  Created At: {task.get('created_at')}")
            print(f"  Status: {status}")
            print(f"  Type: {task.get('task_type')}")
            print(f"  Error Msg: {task.get('error_message')}")
            print(f"  Error Info: {task.get('error')}")
            print("-" * 50)
            count += 1

if __name__ == '__main__':
    asyncio.run(inspect())
