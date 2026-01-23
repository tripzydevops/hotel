import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from dotenv import load_dotenv
load_dotenv(".env.local", override=True)

import asyncio
from uuid import UUID
from datetime import date
from unittest.mock import AsyncMock, patch

# Mock SerpApi BEFORE importing main
mock_serpapi = AsyncMock()
with patch('backend.services.serpapi_client.SerpApiClient.fetch_hotel_price', mock_serpapi):
    from backend.main import trigger_monitor, get_supabase, create_hotel
    from backend.services import serpapi_client
    from backend.models.schemas import HotelCreate
    # Also patch the singleton instance
    serpapi_client.fetch_hotel_price = mock_serpapi
    
    # Configure mock return value
    mock_serpapi.return_value = {
        "hotel_name": "Test Implementation",
        "price": 99.99,
        "currency": "EUR", # This will be set by the currency parameter passed to fetch_hotel_price
        "vendor": "Mock Vendor",
        "rating": 4.5,
        "stars": 5
    }

    # Override currency to match input
    async def side_effect(hotel_name, location, check_in=None, currency="USD"):
        return {
            "hotel_name": hotel_name,
            "price": 99.99,
            "currency": currency,
            "vendor": "Mock Vendor",
            "rating": 4.5,
            "stars": 5
        }
    mock_serpapi.side_effect = side_effect

async def verify_implementation():
    db = get_supabase()
    if not db:
        print("Error: Supabase client not available")
        return

    test_user_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    test_hotel_name = f"Test Implementation {date.today().isoformat()}"
    
    print(f"--- Step 1: Creating test hotel with EUR currency ---")
    hotel_data = HotelCreate(
        name=test_hotel_name,
        location="Berlin, Germany",
        is_target_hotel=False,
        preferred_currency="EUR"
    )
    
    new_hotel = await create_hotel(test_user_id, hotel_data, db)
    hotel_id = new_hotel["id"]
    print(f"Created hotel: {test_hotel_name} with ID: {hotel_id}")

    try:
        print(f"--- Step 2: Triggering monitor scan ---")
        result = await trigger_monitor(test_user_id, date.today(), db)
        print(f"Monitor result: {result}")

        print(f"--- Step 3: Verifying price_logs currency ---")
        price_logs = db.table("price_logs").select("*").eq("hotel_id", str(hotel_id)).order("recorded_at", desc=True).limit(1).execute()
        
        if price_logs.data:
            latest_price = price_logs.data[0]
            print(f"Latest price log: {latest_price['price']} {latest_price['currency']}")
            if latest_price['currency'] == 'EUR':
                print("SUCCESS: Currency correctly saved as EUR")
            else:
                print(f"FAILURE: Currency is {latest_price['currency']}, expected EUR")
        else:
            print("FAILURE: No price logs found for test hotel")

        print(f"--- Step 4: Verifying scan history entry ---")
        scan_history = db.table("query_logs").select("*").eq("user_id", str(test_user_id)).eq("action_type", "monitor").order("created_at", desc=True).limit(5).execute()
        
        if any(log['hotel_name'] == test_hotel_name.title() for log in scan_history.data):
             print("SUCCESS: Scan history contains the test hotel entry")
        else:
             print("FAILURE: Scan history entry not found")

    finally:
        print(f"--- Step 5: Cleanup ---")
        db.table("hotels").delete().eq("id", str(hotel_id)).execute()
        print(f"Deleted test hotel: {hotel_id}")

if __name__ == "__main__":
    asyncio.run(verify_implementation())
