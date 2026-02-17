
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from backend.services.analysis_service import get_market_intelligence_data

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def verify_fix():
    print("--- Final Verification: Calendar Data Restoration ---")
    
    # 1. Target Hotel: Ramada Residences
    hid = "838f4714-4cfa-4ff7-bad2-67f3960667bf"
    h_res = supabase.table("hotels").select("*").eq("id", hid).execute()
    if not h_res.data:
        print("Hotel not found")
        return
    
    user_id = h_res.data[0]["user_id"]
    print(f"Verifying for User: {user_id}")
    
    # 2. Call the real market intelligence function for the calendar range
    # Range from screenshot: 12.02.2026 - 25.02.2026
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
    print(f"\nTotal Daily Prices Returned: {len(daily_prices)}")
    
    # Check specific dates from the screenshot
    target_dates = ["2026-02-12", "2026-02-13", "2026-02-14", "2026-02-15"]
    found_any = False
    
    print("\nSpot Checks (Target Hotel):")
    for dp in daily_prices:
        if dp["date"] in target_dates:
            price = dp.get("price")
            is_est = dp.get("is_estimated_target", False)
            print(f"  Date: {dp['date']} | Price: {price} | Estimated: {is_est}")
            if price is not None:
                found_any = True

    if found_any:
        print("\n✅ Verification SUCCESS: Prices found for target hotel in requested range.")
    else:
        print("\n❌ Verification FAILED: Prices still N/A for target hotel.")

if __name__ == "__main__":
    asyncio.run(verify_fix())
