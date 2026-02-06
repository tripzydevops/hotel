import os
import asyncio
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timezone
import json

# Mocking the dependencies
from enum import Enum
class TrendDirection(str, Enum):
    UP = "up"
    DOWN = "down"
    STABLE = "stable"

EXCHANGE_RATES_TO_USD = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.26,
    "TRY": 0.029,
}

def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
    if from_currency == to_currency:
        return amount
    usd_rate = EXCHANGE_RATES_TO_USD.get(from_currency, 1.0)
    usd_amount = amount * usd_rate
    target_rate = EXCHANGE_RATES_TO_USD.get(to_currency, 1.0)
    return round(usd_amount / target_rate, 2)

class PriceComparator:
    def calculate_trend(self, current_price: float, previous_price):
        if previous_price is None or previous_price == 0:
            return TrendDirection.STABLE, 0.0
        change_percent = ((current_price - previous_price) / previous_price) * 100
        if change_percent > 0.5:
            return TrendDirection.UP, round(change_percent, 2)
        elif change_percent < -0.5:
            return TrendDirection.DOWN, round(change_percent, 2)
        else:
            return TrendDirection.STABLE, round(change_percent, 2)

price_comparator = PriceComparator()

load_dotenv()
load_dotenv(".env.local", override=True)

async def reproduce_full_logic():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    db = create_client(url, key)
    
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    print(f"Testing dashboard full logic for user: {user_id}")
    
    try:
        # 1. Fetch hotels
        hotels_result = db.table("hotels").select("*").eq("user_id", user_id).execute()
        hotels = hotels_result.data or []
        
        # 2. Batch price fetch
        hotel_ids = [str(h["id"]) for h in hotels]
        hotel_prices_map = {}
        price_limit = len(hotel_ids) * 2
        all_prices_res = db.table("price_logs") \
            .select("*") \
            .in_("hotel_id", hotel_ids) \
            .order("recorded_at", desc=True) \
            .limit(price_limit) \
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
                    raw_prev = float(previous_price["price"])
                    prev_currency = previous_price.get("currency") or "USD"
                    previous = convert_currency(raw_prev, prev_currency, curr_currency)
                
                t, change = price_comparator.calculate_trend(current, previous)
                trend_val = t.value if hasattr(t, "value") else str(t)

                price_info = {
                    "current_price": current,
                    "previous_price": previous,
                    "currency": curr_currency,
                    "trend": trend_val,
                    "change_percent": change,
                    "recorded_at": str(current_price.get("recorded_at")),
                    "vendor": current_price.get("vendor"),
                }

            valid_history = []
            for p in prices:
                if p.get("price") is not None:
                    valid_history.append({"price": float(p["price"]), "recorded_at": str(p.get("recorded_at"))})

            hotel_data = {**hotel, "price_info": price_info, "price_history": valid_history}
            if hotel.get("is_target_hotel"): target_hotel = hotel_data
            else: competitors.append(hotel_data)

        final_response = {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        # Test Serialization
        json_output = json.dumps(final_response, default=str)
        print("Success! Serialization completed.")
        # print(json_output[:200] + "...")

    except Exception as e:
        import traceback
        print(f"CRASH AT PROCESSING: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(reproduce_full_logic())
