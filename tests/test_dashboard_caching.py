
import asyncio
import time
from backend.services.dashboard_service import get_recent_wins
from backend.utils.db import get_supabase

async def test_caching():
    print("Testing get_recent_wins caching...")
    db = get_supabase()
    
    # First call - should hit DB (or cache if set by previous run, but import reloads usually reset if fresh process)
    # Actually, verify that two calls return the SAME list object ID
    
    print("Call 1...")
    wins1 = await get_recent_wins(db)
    
    print("Call 2...")
    wins2 = await get_recent_wins(db)
    
    if wins1 is wins2:
        print("✅ Success: The returned list objects are identical (Cache HIT).")
    else:
        print("❌ Failure: The returned list objects are different (Cache MISS).")
        
    print(f"Wins count: {len(wins1)}")

if __name__ == "__main__":
    asyncio.run(test_caching())
