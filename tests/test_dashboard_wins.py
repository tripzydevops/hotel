
import asyncio
from backend.services.dashboard_service import get_recent_wins
from backend.utils.db import get_supabase

async def test_recent_wins_call():
    print("Testing get_recent_wins...")
    db = get_supabase()
    try:
        wins = await get_recent_wins(db)
        print(f"Success! Retrieved {len(wins)} wins.")
        if wins:
            print(f"Sample win: {wins[0]}")
    except Exception as e:
        print(f"ERROR calling get_recent_wins: {e}")
        raise e

if __name__ == "__main__":
    asyncio.run(test_recent_wins_call())
