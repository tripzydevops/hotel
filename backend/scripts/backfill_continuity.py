import asyncio
import os
import sys

# Ensure backend modules can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from datetime import datetime, timedelta, date
from backend.utils.db import get_supabase
from backend.utils.helpers import convert_currency

async def backfill_continuity():
    """
    Backfills missing future price data using the 'Vertical Fill' logic.
    User Requirement:
    - If a future date has no price, check past scans for that specific date (up to 7 days back).
    - If found, insert an estimated record.
    """
    print("Starting Smart Continuity Backfill...")
    db = get_supabase()
    if not db:
        print("Database connection failed.")
        return

    # 1. Get all active hotels
    hotels_res = db.table("hotels").select("id, name, preferred_currency").execute()
    hotels = hotels_res.data or []
    print(f"Found {len(hotels)} hotels.")

    # Modified to look back 4 days (to match calendar view) instead of just Today
    start_date = datetime.now().date() - timedelta(days=4)
    end_date = datetime.now().date() + timedelta(days=30)
    
    total_filled = 0

    for hotel in hotels:
        hotel_id = hotel["id"]
        hotel_name = hotel["name"]
        print(f"\nChecking {hotel_name}...")

        # Get existing future logs to identify gaps
        future_logs_res = db.table("price_logs") \
            .select("check_in_date") \
            .eq("hotel_id", hotel_id) \
            .gte("check_in_date", start_date.isoformat()) \
            .lte("check_in_date", end_date.isoformat()) \
            .execute()
        
        existing_dates = set()
        for log in (future_logs_res.data or []):
            if log.get("check_in_date"):
                existing_dates.add(log["check_in_date"])
        
        # Iterate through next 30 days
        curr = start_date
        while curr <= end_date:
            d_str = curr.isoformat()
            
            if d_str not in existing_dates:
                # GAP DETECTED
                # Apply Vertical Fill Logic: Look back 7 days for this specific check_in_date
                cutoff = (datetime.now() - timedelta(days=7)).isoformat()
                
                try:
                    history_res = db.table("price_logs") \
                        .select("*") \
                        .eq("hotel_id", hotel_id) \
                        .eq("check_in_date", d_str) \
                        .gt("recorded_at", cutoff) \
                        .order("recorded_at", desc=True) \
                        .limit(1) \
                        .execute()
                    
                    if history_res.data:
                        last_valid = history_res.data[0]
                        price = last_valid["price"]
                        currency = last_valid["currency"]
                        
                        print(f"  [FILL] Found gap for {d_str}. Filled with {price} {currency} from {last_valid['recorded_at']}")
                        
                        # Insert Estimated Record
                        new_log = {
                            "hotel_id": hotel_id,
                            "price": price,
                            "currency": currency,
                            "check_in_date": d_str,
                            "source": "smart_continuity_backfill",
                            "vendor": last_valid.get("vendor", "Backfill"),
                            "is_estimated": True, # Critical flag
                            "room_types": last_valid.get("room_types", []),
                            "offers": last_valid.get("offers", [])
                        }
                        db.table("price_logs").insert(new_log).execute()
                        total_filled += 1
                    else:
                        # Optional: Insert 'Verification Failed' (price=0) if we want to show FAILED badge
                        # strictly for dates that are very soon (e.g., today/tomorrow) but not for 30 days out.
                        # User's complaint was about "gaps", so sticking to filling data first.
                        # print(f"  [SKIP] Gap for {d_str} but no history found.")
                        pass

                except Exception as e:
                    print(f"Error processing {hotel_name} date {d_str}: {e}")

            curr += timedelta(days=1)

    print(f"\nBackfill Complete. Filled {total_filled} missing prices.")

if __name__ == "__main__":
    asyncio.run(backfill_continuity())
