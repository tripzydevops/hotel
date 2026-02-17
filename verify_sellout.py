
import asyncio
import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
from backend.services.analysis_service import perform_market_analysis

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def verify_sellout_logic():
    print("--- Verification: Sellout Detection Logic ---")
    
    # Mock data with a 0 price for one hotel
    mock_hotels = [
        {"id": "h1", "name": "Target Hotel", "is_target_hotel": True, "rating": 4.5, "review_count": 100},
        {"id": "h2", "name": "Onhann (Zero Price)", "is_target_hotel": False, "rating": 4.0, "review_count": 50},
        {"id": "h3", "name": "Normal Comp", "is_target_hotel": False, "rating": 4.2, "review_count": 80}
    ]
    
    mock_prices_map = {
        "h1": [{"price": 4000.0, "currency": "TRY", "room_types": [{"name": "Standard", "price": 4000.0}]}],
        "h2": [{"price": 0.0, "currency": "TRY", "room_types": [{"name": "Standard", "price": 0.0}]}],
        "h3": [{"price": 4200.0, "currency": "TRY", "room_types": [{"name": "Standard", "price": 4200.0}]}]
    }
    
    result = await perform_market_analysis(
        user_id="test_user",
        hotels=mock_hotels,
        hotel_prices_map=mock_prices_map,
        display_currency="TRY",
        room_type="Standard",
        start_date=None,
        end_date=None,
        allowed_room_names_map={}
    )
    
    price_rank = result.get("price_rank_list", [])
    
    print("\nPrice Rank List Results:")
    found_onhann = False
    for item in price_rank:
        name = item["name"]
        price = item["price"]
        is_sellout = item.get("is_sellout", False)
        print(f"  Hotel: {name} | Price: {price} | Is Sellout: {is_sellout}")
        
        if "Onhann" in name:
            found_onhann = True
            if is_sellout:
                print("  ✅ SUCCESS: Onhann correctly tagged as Sellout.")
            else:
                print("  ❌ FAILURE: Onhann NOT tagged as Sellout.")

    if not found_onhann:
        print("  ❌ FAILURE: Onhann not found in results.")

if __name__ == "__main__":
    asyncio.run(verify_sellout_logic())
