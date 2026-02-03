import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv
from uuid import UUID

load_dotenv()
load_dotenv(".env.local", override=True)

async def test_dashboard():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    db = create_client(url, key)
    
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    print(f"Testing dashboard for user: {user_id}")
    
    # Simulate the logic in main.py get_dashboard
    try:
        # 1. Fetch hotels
        hotels_result = db.table("hotels").select("*").eq("user_id", user_id).execute()
        hotels = hotels_result.data or []
        print(f"Found {len(hotels)} hotels")
        
        # 2. Fetch price logs
        hotel_ids = [str(h["id"]) for h in hotels]
        all_prices_res = db.table("price_logs") \
            .select("*") \
            .in_("hotel_id", hotel_ids) \
            .order("recorded_at", desc=True) \
            .limit(len(hotel_ids) * 2) \
            .execute()
        print(f"Found {len(all_prices_res.data)} price logs")

        # 3. Check for recent sessions
        sess_res = db.table("scan_sessions").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
        print(f"Found {len(sess_res.data)} sessions")
        
        print("\nAll DB queries successful. The crash might be in the Python processing logic (currency conversion, trend calculation, or Pydantic validation).")

    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_dashboard())
