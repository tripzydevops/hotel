import asyncio
from datetime import datetime, timedelta, timezone
from backend.utils.db import get_supabase
from backend.services.monitor_service import run_scheduler_check_logic

async def main():
    supabase = get_supabase(admin=True)
    print("Step 1: Resetting last_global_scan_at to trigger fresh heartbeat...")
    old_time = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
    supabase.table("admin_settings").update({"last_global_scan_at": old_time}).neq("id", "00000000-0000-0000-0000-000000000000").execute()
    
    print("Step 2: Running scheduler logic (Cleanup + New Heartbeat)...")
    await run_scheduler_check_logic()
    print("Scheduler logic finished.")

if __name__ == "__main__":
    asyncio.run(main())
