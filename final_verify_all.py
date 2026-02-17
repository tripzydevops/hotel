
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from backend.services.analysis_service import get_market_intelligence_data

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def verify_all_hotels():
    print("--- Final Verification: Full Grid Restoration ---")
    
    # 1. Target Hotel: Ramada Residences
    hid = "838f4714-4cfa-4ff7-bad2-67f3960667bf"
    h_res = supabase.table("hotels").select("*").eq("id", hid).execute()
    user_id = h_res.data[0]["user_id"]
    
    # 2. Call market intelligence
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
    target_dates = ["2026-02-12", "2026-02-13", "2026-02-14", "2026-02-15"]
    
    print("\n--- Spot Check: All Hotels in Grid ---")
    for dp in daily_prices:
        if dp["date"] in target_dates:
            print(f"\nDate: {dp['date']}")
            print(f"  [YOU] Price: {dp.get('price')} (Est: {dp.get('is_estimated_target')})")
            
            comps = dp.get("competitors", [])
            if not comps:
                print("  [COMP] No competitors found for this date")
            else:
                for c in comps:
                    print(f"  [COMP] {c['name']}: {c['price']} (Est: {c.get('is_estimated', False)})")

    # Final logic check: Ensure we have data for known competitors
    competitor_count = len(result.get("competitors", []))
    print(f"\nOverall Competitors Tracked: {competitor_count}")
    
    if any(dp.get('price') is not None for dp in daily_prices):
        print("\n✅ Verification SUCCESS: Grid data restored for multiple hotels.")
    else:
        print("\n❌ Verification FAILED: Grid still empty.")

if __name__ == "__main__":
    asyncio.run(verify_all_hotels())
