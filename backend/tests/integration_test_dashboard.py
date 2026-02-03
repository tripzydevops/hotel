import os
import asyncio
import json
from datetime import datetime, timezone
from uuid import UUID
from dotenv import load_dotenv

# Set up environment
load_dotenv()
load_dotenv(".env.local", override=True)

# Important: Mocking Sys Path to include root
import sys
sys.path.append(os.getcwd())

from backend.main import get_supabase, convert_currency
from backend.services.price_comparator import price_comparator
from fastapi.encoders import jsonable_encoder

async def test_dashboard_integration():
    db = get_supabase()
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    
    print(f"Testing Dashboard Integration for {user_id}...")
    
    try:
        # Replicate the core part of get_dashboard
        hotels_result = db.table("hotels").select("*").eq("user_id", user_id).execute()
        hotels = hotels_result.data or []
        print(f"Hotels: {len(hotels)}")

        hotel_ids = [str(h["id"]) for h in hotels]
        hotel_prices_map = {}
        all_prices_res = db.table("price_logs") \
            .select("*") \
            .in_("hotel_id", hotel_ids) \
            .order("recorded_at", desc=True) \
            .limit(len(hotel_ids) * 2) \
            .execute()
        
        for p in (all_prices_res.data or []):
            hid = str(p["hotel_id"])
            if hid not in hotel_prices_map: hotel_prices_map[hid] = []
            if len(hotel_prices_map[hid]) < 10: hotel_prices_map[hid].append(p)

        target_hotel = None
        competitors = []

        for hotel in hotels:
            hid = str(hotel["id"])
            prices = hotel_prices_map.get(hid, [])
            current_price = prices[0] if prices else None
            previous_price = prices[1] if len(prices) > 1 else None
            
            price_info = None
            if current_price and current_price.get("price") is not None:
                current = float(current_price["price"])
                curr_currency = current_price.get("currency") or "USD"
                
                previous = None
                if previous_price and previous_price.get("price") is not None:
                    try:
                        raw_prev = float(previous_price["price"])
                        prev_currency = previous_price.get("currency") or "USD"
                        previous = convert_currency(raw_prev, prev_currency, curr_currency)
                    except Exception:
                        previous = None
                
                trend_val = "stable"
                change = 0.0
                try:
                    t, change = price_comparator.calculate_trend(current, previous)
                    trend_val = t.value if hasattr(t, "value") else str(t)
                except Exception:
                    pass

                price_info = {
                    "current_price": current,
                    "previous_price": previous,
                    "currency": curr_currency,
                    "trend": trend_val,
                    "change_percent": change,
                    "recorded_at": current_price.get("recorded_at"),
                    "vendor": current_price.get("vendor"),
                }

            hotel_data = {**hotel, "price_info": price_info}
            if hotel.get("is_target_hotel"): target_hotel = hotel_data
            else: competitors.append(hotel_data)

        # Build response
        final_response = {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        # Test Serialization with jsonable_encoder
        encoded = jsonable_encoder(final_response)
        json.dumps(encoded)
        print("Integration SUCCESS! No crashes detected.")

    except Exception as e:
        import traceback
        print(f"Integration FAILED: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_dashboard_integration())
