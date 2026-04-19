import asyncio
import time
import sys
from backend.services.monitor_service import run_scheduler_check_logic
from backend.utils.db import get_supabase

async def loop_monitor():
    print("Starting Continuous Monitor Loop (30s intervals)...", flush=True)
    try:
        db = get_supabase(admin=True)
        print("Database connection initialized.", flush=True)
    except Exception as e:
        print(f"Database Error: {e}", flush=True)
        return

    while True:
        try:
            print(f"[{time.ctime()}] Running monitor check...", flush=True)
            await run_scheduler_check_logic()
            print(f"[{time.ctime()}] Check complete.", flush=True)
        except Exception as e:
            print(f"[{time.ctime()}] Monitor Error: {e}", flush=True)
        
        await asyncio.sleep(30)

if __name__ == "__main__":
    asyncio.run(loop_monitor())
