
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from backend.services.analysis_service import get_market_intelligence_data

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def verify_future_restriction():
    print("--- Verification: Future Forward-Fill Restriction ---")
    
    # Bugün: 17.02.2026
    hid = "838f4714-4cfa-4ff7-bad2-67f3960667bf"
    h_res = supabase.table("hotels").select("*").eq("id", hid).execute()
    user_id = h_res.data[0]["user_id"]
    
    # 12.02.2026 - 25.02.2026
    start_date = "2026-02-12T00:00:00Z"
    end_date = "2026-02-25T23:59:59Z"
    
    result = await get_market_intelligence_data(
        db=supabase,
        user_id=user_id,
        room_type="Standard",
        start_date=start_date,
        end_date=end_date
    )
    
    daily_prices = result.get("daily_prices", [])
    today_str = "2026-02-17"
    
    print(f"\nScanning range: 2026-02-12 to 2026-02-25")
    print(f"Today (Reference): {today_str}")
    
    found_future_estimate = False
    for dp in daily_prices:
        date = dp["date"]
        price = dp.get("price")
        is_est = dp.get("is_estimated_target", False)
        
        # Check if it is a future date relative to Feb 17
        if date > today_str:
            if price is not None:
                # If price exists in the future, it must be because of an actual scan, 
                # not the 'last_known' carry-over.
                # In our test case, we know we don't have future scans for Ramada.
                print(f"  [FUTURE] Date: {date} | Price: {price} | Est: {is_est}")
                found_future_estimate = True
            else:
                print(f"  [FUTURE] Date: {date} | Price: N/A (Correctly restricted)")

    if not found_future_estimate:
        print("\n✅ Verification SUCCESS: No forward-filled estimates for future dates.")
    else:
        print("\n❌ Verification FAILED: Found estimates in the future.")

if __name__ == "__main__":
    asyncio.run(verify_future_restriction())
