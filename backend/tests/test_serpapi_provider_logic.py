
import asyncio
import json
import sys
import os
from unittest.mock import MagicMock, AsyncMock
import httpx

sys.path.append(os.getcwd())
from backend.services.providers.serpapi_provider import SerpApiProvider

async def test_parsing():
    provider = SerpApiProvider()
    
    # Mock data resembling SerpApi response
    mock_data = {
        "properties": [
            {
                "name": "Hilton Garden Inn Balikesir",
                "hotel_id": "target_id_123",
                "property_token": "token_abc",
                "overall_rating": 4.8,
                "reviews": 150,
                "extracted_hotel_class": 4,
                "rate_per_night": {"extracted_lowest": 1200},
                "images": [{"thumbnail": "thumb_url", "original": "orig_url"}],
                "amenities": ["WiFi", "Pool"],
                "prices": [
                    {"source": "Booking.com", "rate_per_night": {"lowest": "1.200 TL"}},
                    {"source": "Expedia", "rate_per_night": {"lowest": "1.250 TL"}}
                ],
                "rooms": [
                    {"name": "Standard Room", "rate_per_night": {"lowest": "1.200 TL"}}
                ],
                "reviews_breakdown": [{"description": "Great stay"}]
            }
        ]
    }
    
    print("\n--- Testing Exact ID Match ---")
    result = provider._parse_hotel_result(mock_data, "Wrong Name", "TRY", "target_id_123")
    if result is None:
        print("❌ Exact ID match failed: result is None")
        return
        
    print(f"Price: {result['price']}")
    assert result["price"] == 1200.0
    print(f"Prop Token: {result['property_token']}")
    # It should be 'token_abc' because it prefers property_token
    assert result["property_token"] in ["target_id_123", "token_abc"]
    assert len(result["offers"]) == 2
    assert result["offers"][0]["vendor"] == "Booking.com"
    assert len(result["room_types"]) == 1
    assert result["rating"] == 4.8
    print("✅ Exact ID match passed")

    print("\n--- Testing Fuzzy Name Match ---")
    result = provider._parse_hotel_result(mock_data, "Hilton Garden Balikesir", "TRY", None)
    assert result is not None
    assert result["property_token"] in ["target_id_123", "token_abc"]
    print("✅ Fuzzy name match passed")

    print("\n--- Testing Rich Data Extraction ---")
    assert len(result["images"]) == 1
    assert result["amenities"] == ["WiFi", "Pool"]
    assert len(result["reviews_breakdown"]) == 1
    print("✅ Rich data extraction passed")

    print("\n--- Testing Price Cleaning ---")
    assert provider._clean_price_string("1.200,50 TL", "TRY") == 1200.50
    assert provider._clean_price_string("€1,200.50", "EUR") == 1200.50
    print("✅ Price cleaning passed")

if __name__ == "__main__":
    asyncio.run(test_parsing())
