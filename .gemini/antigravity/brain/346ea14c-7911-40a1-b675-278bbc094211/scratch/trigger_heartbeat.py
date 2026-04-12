import asyncio
import os
import sys
from datetime import datetime, timezone

# Add parent directory to path to allow searching for backend modules
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase_client
from backend.services.monitor_service import run_system_heartbeat

async def main():
    print(f"[{datetime.now().isoformat()}] Triggering system heartbeat...")
    db = get_supabase_client()
    
    # run_system_heartbeat is an async function
    await run_system_heartbeat(db)
    print(f"[{datetime.now().isoformat()}] Heartbeat triggered successfully.")

if __name__ == "__main__":
    asyncio.run(main())
