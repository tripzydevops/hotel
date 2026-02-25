
import os
import sys
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.getcwd())

from backend.services.analysis_service import get_price_for_room

# Mock data based on the real logs found
MOCK_LOG = {
    "hotel_id": "mock_altin_otel",
    "price": 4097.0,
    "currency": "TRY",
    "room_types": [
        {"name": "Standart Çift Kişilik/İki Yataklı Oda", "price": 4097.0},
        {"name": "Başkanlık Odası", "price": 18485.0},
        {"name": "Standart Çift Kişilik veya İki Yataklı Oda", "price": 4106.0},
        {"name": "Standart Süit", "price": 12350.0},
        {"name": "King Süit - Spa Küvetli", "price": 18525.0}
    ]
}

ALLOWED_MAP = {} # Empty map to trigger fallback logic

def test_room_matching():
    print("--- Verifying Room Type Matching Fixes ---")
    
    # Test 1: Standard Request
    # Previously, this might have picked Presidential if it was first in the list 
    # and miscategorized. Now it should skip Presidential and pick the lowest Standard.
    price, name, score = get_price_for_room(MOCK_LOG, "Standard", ALLOWED_MAP)
    print(f"Request: 'Standard' | Result: {price} ({name}) | Score: {score}")
    if price == 4097.0 and "Standart" in name:
        print("[SUCCESS] Correct Standard price selected, Presidential ignored.")
    else:
        print(f"[FAILURE] Wrong price or room selected for Standard: {price} ({name})")

    # Test 2: Suite Request
    # Should pick a Suite, prioritizing ones with 'Presidential' or 'Süit' keywords
    price, name, score = get_price_for_room(MOCK_LOG, "Suite", ALLOWED_MAP)
    print(f"\nRequest: 'Suite' | Result: {price} ({name}) | Score: {score}")
    # Note: Backend might pick 12350 or 18485 depending on exact matching score
    if price is not None and ("Süit" in name or "Başkanlık" in name):
        print("[SUCCESS] Suite correctly identified.")
    else:
        print(f"[FAILURE] Failed to find a Suite: {price} ({name})")

    # Test 3: Standart (Turkish)
    price, name, score = get_price_for_room(MOCK_LOG, "Standart", ALLOWED_MAP)
    print(f"\nRequest: 'Standart' | Result: {price} ({name}) | Score: {score}")
    if price == 4097.0:
        print("[SUCCESS] Turkish 'Standart' correctly matched.")
    else:
        print(f"[FAILURE] Turkish 'Standart' failed.")

if __name__ == "__main__":
    test_room_matching()
