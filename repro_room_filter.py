
from backend.services.analysis_service import get_price_for_room

# Mock price log structure
PRICE_LOG_MIXED = {
    "hotel_id": "123",
    "room_types": [
        {"name": "Standard Room", "price": 100},
        {"name": "Deluxe Suite", "price": 200},
        {"name": "Presidential Suite", "price": 500}
    ]
}

PRICE_LOG_ONLY_STANDARD = {
    "hotel_id": "123",
    "room_types": [
        {"name": "Standard Room", "price": 100},
    ]
}

ALLOWED_MAP = {}

def test_strict_matching():
    # 1. Matching "Suite" -> Should match "Deluxe Suite" or return None if strict
    # Current behavior might return Standard or Cheapest if not found
    price, name, score = get_price_for_room(PRICE_LOG_ONLY_STANDARD, "Suite", ALLOWED_MAP)
    
    print(f"Scenario 1 (Request 'Suite', Only 'Standard' avail): Price={price}, Name={name}, Score={score}")
    
    if price is not None:
        print("FAIL: Returned a price when no Suite was available. Strict matching failed.")
    else:
        print("PASS: Returned None when no Suite was available.")

    # 2. Matching "Suite" -> Should match "Deluxe Suite"
    price, name, score = get_price_for_room(PRICE_LOG_MIXED, "Suite", ALLOWED_MAP)
    print(f"Scenario 2 (Request 'Suite', 'Deluxe Suite' avail): Price={price}, Name={name}, Score={score}")

if __name__ == "__main__":
    test_strict_matching()
