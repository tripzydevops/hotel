
from typing import Dict, Any

def mock_parse_rich_data(data: Dict[str, Any]) -> Dict[str, Any]:
    # Logic copied from serpapi_client.py
    best_match = data.get("properties", [])[0]
    
    return {
        "hotel_name": best_match.get("name"),
        "amenities": best_match.get("amenities", []),
        "images": [
            {"thumbnail": img.get("thumbnail"), "original": img.get("original")} 
            for img in best_match.get("images", [])[:10]
        ],
        "offers_count": len(best_match.get("prices", []) or [])
    }

# Mock Data based on standard SerpApi 'google_hotels' knowledge graph result
mock_response = {
    "properties": [
        {
            "name": "Willmont Hotel",
            "amenities": ["Free Wi-Fi", "Pool", "Spa"],
            "images": [
                {"thumbnail": "http://thumb.com/1.jpg", "original": "http://img.com/1.jpg"},
                {"thumbnail": "http://thumb.com/2.jpg"} 
            ],
            "prices": [
                {"source": "Booking.com", "rate_per_night": {"lowest": "$100"}},
                {"source": "Expedia", "rate_per_night": {"lowest": "$105"}}
            ]
        }
    ]
}

print("Testing Extraction:")
result = mock_parse_rich_data(mock_response)
print(f"Amenities Found: {len(result['amenities'])}")
print(f"Images Found: {len(result['images'])}")
print(f"Offers Found: {result['offers_count']}")
print(f"Result: {result}")
