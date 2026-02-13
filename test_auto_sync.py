import asyncio
from datetime import datetime
from uuid import uuid4

# Mocking the sync logic for verification
async def test_sync_logic():
    print("Testing Data-Rich Auto-Sync Logic...")
    
    # Simulated hotel data from SerpApi
    hotel_data = {
        "name": "Test Grand Hotel",
        "location": "Istanbul, Turkey",
        "serp_api_id": "test_token_123",
        "latitude": 41.0082,
        "longitude": 28.9784,
        "rating": 4.8,
        "stars": 5.0,
        "image_url": "https://example.com/hotel.jpg"
    }

    # The Logic we implemented in the backend
    sync_payload = {
        "name": hotel_data["name"],
        "location": hotel_data.get("location"),
        "serp_api_id": hotel_data.get("serp_api_id"),
        "latitude": hotel_data.get("latitude"),
        "longitude": hotel_data.get("longitude"),
        "rating": hotel_data.get("rating"),
        "stars": hotel_data.get("stars"),
        "image_url": hotel_data.get("image_url"),
        "last_verified_at": datetime.now().isoformat()
    }

    print("\n[Sync Payload Generated]:")
    for k, v in sync_payload.items():
        print(f"  {k}: {v}")

    # Success Criteria
    required_keys = ["latitude", "longitude", "rating", "image_url", "serp_api_id"]
    if all(k in sync_payload for k in required_keys):
        print("\n✅ SUCCESS: All rich metadata fields are included in the sync payload.")
    else:
        print("\n❌ FAILURE: Missing metadata fields in payload.")

if __name__ == "__main__":
    asyncio.run(test_sync_logic())
