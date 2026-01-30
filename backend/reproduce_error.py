
import os
import uuid
from datetime import datetime, date, timezone
from typing import List, Dict, Any
from pydantic import ValidationError

# Mock the environment to load models from backend
import sys
sys.path.append(os.getcwd())

from backend.models.schemas import (
    DashboardResponse, HotelWithPrice, QueryLog, ScanSession, PriceWithTrend, TrendDirection
)

def test_model_instantiation():
    print("Testing Pydantic Model Instantiation (v1.0.4+ Matcher)...")
    
    try:
        # 1. Test PriceWithTrend with rich data
        price_info = {
            "current_price": 150.0,
            "previous_price": 140.0,
            "currency": "TRY",
            "trend": "up",
            "change_percent": 7.14,
            "recorded_at": datetime.now(),
            "vendor": "Booking.com",
            "check_in": date.today(),
            "check_out": date.today(),
            "adults": 2,
            "offers": [],
            "room_types": []
        }
        pt = PriceWithTrend(**price_info)
        print("✅ PriceWithTrend instantiated successfully")

        # 2. Test HotelWithPrice with fractional stars
        hotel_data = {
            "id": uuid.uuid4(),
            "name": "Test Hotel",
            "is_target_hotel": True,
            "location": "Istanbul",
            "rating": 4.8,
            "stars": 4.5, # FIXED: was crashing if int
            "image_url": "http://image.com",
            "amenities": ["Wifi", "Pool"],
            "images": [{"url": "http://img1.png"}],
            "price_info": pt,
            "price_history": []
        }
        hw = HotelWithPrice(**hotel_data)
        print("✅ HotelWithPrice instantiated successfully")

        # 3. Test DashboardResponse with multiple lists
        resp = DashboardResponse(
            target_hotel=hw,
            competitors=[hw],
            recent_searches=[],
            scan_history=[],
            recent_sessions=[],
            unread_alerts_count=5,
            last_updated=datetime.now(timezone.utc)
        )
        print("✅ DashboardResponse instantiated successfully")
        
    except ValidationError as e:
        print(f"❌ Pydantic Validation Failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False
    
    print("\nSUCCESS: All models are consistent with expected dashboard data.")
    return True

if __name__ == "__main__":
    test_model_instantiation()
