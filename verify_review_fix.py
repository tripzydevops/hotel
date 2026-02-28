
import asyncio
from typing import Dict, List, Any
from backend.services.analysis_service import perform_market_analysis

async def verify_review_fix():
    # Mock data
    hotels = [
        {
            "id": "hotel_1",
            "name": "My Hotel",
            "rating": 4.5,
            "review_count": 945,
            "is_target_hotel": True
        },
        {
            "id": "hotel_2",
            "name": "Competitor 1",
            "rating": 4.4,
            "review_count": 1976
        },
        {
            "id": "hotel_3",
            "name": "Competitor 2",
            "rating": 4.5,
            "review_count": 550
        }
    ]
    
    hotel_prices_map = {
        "hotel_1": [{"price": 4038, "currency": "TRY", "recorded_at": "2026-02-26T12:00:00"}],
        "hotel_2": [{"price": 4107, "currency": "TRY", "recorded_at": "2026-02-26T12:00:00"}],
        "hotel_3": [{"price": 5695, "currency": "TRY", "recorded_at": "2026-02-26T12:00:00"}]
    }
    
    print("Running verification for perform_market_analysis...")
    
    result = await perform_market_analysis(
        user_id="user_123",
        hotels=hotels,
        hotel_prices_map=hotel_prices_map,
        display_currency="TRY",
        room_type="Standard",
        start_date=None,
        end_date=None,
        allowed_room_names_map={}
    )
    
    # Check price_rank_list
    print("\n--- Price Rank List ---")
    for item in result["price_rank_list"]:
        print(f"Hotel: {item['name']} | Reviews: {item.get('review_count')}")
        if item.get('review_count') is None:
            print("ERROR: review_count missing in price_rank_list")
        elif item.get('review_count') == 0 and item['name'] != "Unknown":
             print("WARNING: review_count is 0")

    # Check competitors list
    print("\n--- Competitors List ---")
    for item in result["competitors"]:
        print(f"Hotel: {item['name']} | Reviews: {item.get('review_count')}")
        if item.get('review_count') is None:
            print("ERROR: review_count missing in competitors list")

    print("\nVerification Complete.")

if __name__ == "__main__":
    asyncio.run(verify_review_fix())
