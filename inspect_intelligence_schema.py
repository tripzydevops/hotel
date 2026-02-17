import asyncio
from backend.utils.db import get_supabase

async def inspect_schema():
    db = get_supabase()
    if not db:
        print("DB connection failed")
        return

    print("--- Inspecting price_logs Schema ---")
    # Fetch one record to see columns
    try:
        res = db.table("price_logs").select("*").limit(1).execute()
        if res.data:
            print(f"Columns found: {list(res.data[0].keys())}")
            print(f"Sample row: {res.data[0]}")
        else:
            print("No data in price_logs to inspect columns.")
    except Exception as e:
        print(f"Error selecting from price_logs: {e}")

    print("\n--- Inspecting hotel_directory Schema ---")
    try:
        res = db.table("hotel_directory").select("*").limit(1).execute()
        if res.data:
            print(f"Columns found: {list(res.data[0].keys())}")
            print(f"Sample row: {res.data[0]}")
        else:
             print("No data in hotel_directory.")
    except Exception as e:
        print(f"Error selecting from hotel_directory: {e}")

if __name__ == "__main__":
    asyncio.run(inspect_schema())
