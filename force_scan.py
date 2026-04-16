import asyncio
from datetime import datetime, timedelta, timezone
from backend.utils.db import get_supabase
from backend.services.monitor_service import run_scheduler_check_logic

async def main():
    supabase = get_supabase(admin=True)
    print("Step 1: Resetting last_global_scan_at to trigger fresh heartbeat...")
    old_time = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat().replace("+00:00", "Z")
    
    # Corrected filter: Update the singleton record (all zeros ID)
    supabase.table("admin_settings")\
        .update({"last_global_scan_at": old_time})\
        .eq("id", "00000000-0000-0000-0000-000000000000")\
        .execute()
    
    print("Step 1.5: Mark monitored profiles as 'due'...")
    active_users = supabase.table("user_hotels")\
        .select("user_id")\
        .eq("is_monitored", True)\
        .execute()
    
    if active_users.data:
        unique_ids = list(set([u["user_id"] for u in active_users.data]))
        print(f"Found {len(unique_ids)} active users. Resetting next_scan_at...")
        for uid in unique_ids:
            # Set to 1 min ago to ensure they are 'due'
            due_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
            supabase.table("profiles").update({"next_scan_at": due_time}).eq("id", uid).execute()
    
    print("Step 2: Running scheduler logic (Cleanup + New Heartbeat)...")
    await run_scheduler_check_logic()
    print("Scheduler logic finished.")

if __name__ == "__main__":
    asyncio.run(main())
