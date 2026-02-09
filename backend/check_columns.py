import asyncio
import os
import sys
from dotenv import load_dotenv # type: ignore

# Add root to path
sys.path.append(os.getcwd())
load_dotenv(os.path.join(os.getcwd(), '.env.local'))
load_dotenv(os.path.join(os.getcwd(), '.env'))

from backend.main import get_supabase # type: ignore

async def check_columns():
    db = get_supabase()
    if not db:
        print("Error: Could not connect to Supabase.")
        return

    print("--- Checking Columns in sentiment_history ---")
    try:
        # Fetch one row to see keys
        res = db.table("sentiment_history").select("*").limit(1).execute()
        if res.data:
            print(f"Columns: {list(res.data[0].keys())}")
        else:
            print("No data found to check columns.")
    except Exception as e:
        print(f"Error checking columns: {e}")

if __name__ == "__main__":
    asyncio.run(check_columns())
