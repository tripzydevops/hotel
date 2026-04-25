import asyncio
import os
import sys
from datetime import datetime, timezone

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.utils.db import get_supabase
from backend.services.monitor_service import run_scheduler_check_logic

async def force_scan():
    print("🚀 Initiating Force Test Scan...")
    
    # Set VERCEL_DOMAIN for webhook pingback
    os.environ['VERCEL_DOMAIN'] = 'hotel-delta-green.vercel.app'
    
    # Setup Admin DB Client
    db = get_supabase(admin=True)
    if not db:
        print("❌ Error: Failed to initialize Supabase client.")
        return
    
    # Inject the force flag into the db object to bypass cooldowns
    db._force_heartbeat = True
    
    # Call the autonomous logic directly
    print("📡 Pitching the task to DataForSEO...")
    # Force the scheduler logic using our pre-configured forced client
    await run_scheduler_check_logic(insforge=db)
    
    print("-" * 30)
    print(f"✅ SUCCESS: System check cycle triggered.")
    print("-" * 30)
    print("\n⏳ FINAL STEP: Check the Vercel logs in a few minutes.")

if __name__ == "__main__":
    asyncio.run(force_scan())
