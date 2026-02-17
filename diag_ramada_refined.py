
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Mocked pieces of get_price_for_room from analysis_service.py to test logic
def _extract_price(raw):
    if raw is not None:
        try:
            import re
            if isinstance(raw, str):
                clean = re.sub(r'[^\d.]', '', raw)
                return float(clean)
            return float(raw)
        except: pass
    return None

def test_get_price_for_room(price_log, target_room_type="Standard", allowed_room_names=[]):
    r_types = price_log.get("room_types") or []
    
    # Priority matching mimics
    target_variants = [target_room_type.lower()]
    if target_room_type.lower() in ["standard", "standart"]:
        target_variants.extend(["standard", "standart", "klasik", "classic", "ekonomik", "economy", "promo"])
    
    # PRIORITY 1-3 Simulation
    for r in r_types:
        r_name = (r.get("name") or "").lower()
        if any(v in r_name for v in target_variants):
            return _extract_price(r.get("price")), r.get("name"), 0.85
            
    # STANDARD REQUEST DETECTION
    std_variants = ["standard", "standart", "any", "base", "all room types", "all", "promo", "ekonomik", "economy", "klasik", "classic"]
    target_lower = target_room_type.lower()
    is_standard_request = (not target_lower or any(v in target_lower for v in std_variants) or target_lower == "oda")

    if is_standard_request:
        valid_prices = []
        for r in r_types:
            p = _extract_price(r.get("price"))
            if p is not None:
                valid_prices.append((p, r.get("name") or "Standard (Min)"))
        if valid_prices:
            valid_prices.sort(key=lambda x: x[0])
            return valid_prices[0][0], valid_prices[0][1], 0.5

    # LEGACY FALLBACK
    if (not r_types or len(r_types) == 0) and is_standard_request:
        top_price = _extract_price(price_log.get("price"))
        if top_price is not None:
            return top_price, "Standard (Legacy)", 0.6
            
    return None, None, 0.0

async def diag_ramada_residences():
    hid = "838f4714-4cfa-4ff7-bad2-67f3960667bf" # From previous diag
    print(f"--- Diag for Ramada Residences ({hid}) ---")
    
    # 1. Fetch hotel details
    h_res = supabase.table("hotels").select("*").eq("id", hid).execute()
    if not h_res.data:
        print("Hotel not found")
        return
    print(f"Is Target: {h_res.data[0].get('is_target_hotel')}")
    
    # 2. Fetch price logs for broad range
    logs_res = supabase.table("price_logs") \
        .select("*") \
        .eq("hotel_id", hid) \
        .order("recorded_at", desc=True) \
        .limit(10) \
        .execute()
    
    if not logs_res.data:
        print("No logs found.")
        return

    for log in logs_res.data:
        print(f"\nRecorded: {log['recorded_at']} | Check-in: {log.get('check_in_date')}")
        print(f"Top Price: {log.get('price')}")
        r_types = log.get("room_types") or []
        print(f"Room Types: {len(r_types)}")
        
        # Test matching logic
        matched_p, matched_n, score = test_get_price_for_room(log)
        print(f"Result: Price={matched_p}, Name={matched_n}, Score={score}")
        
        if r_types:
            for rt in r_types[:3]:
                print(f"  - {rt.get('name')}: {rt.get('price')}")

if __name__ == "__main__":
    asyncio.run(diag_ramada_residences())
