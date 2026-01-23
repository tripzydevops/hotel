import sys
import os
import asyncio
from uuid import uuid4
from unittest.mock import MagicMock, patch

# Add root to path
sys.path.append(os.getcwd())

from backend.main import create_hotel, trigger_monitor
from backend.models.schemas import HotelCreate

async def test_hotel_currency_flow():
    user_id = uuid4()
    hotel_data = HotelCreate(
        name="Test Currency Hotel",
        location="Paris, FR",
        is_target_hotel=True,
        preferred_currency="EUR"
    )
    
    # Mock Supabase
    mock_db = MagicMock()
    # Mock create_hotel insert response
    mock_db.table().insert().execute.return_value = MagicMock(data=[{
        "id": str(uuid4()),
        "user_id": str(user_id),
        "name": "Test Currency Hotel",
        "location": "Paris, Fr",
        "is_target_hotel": True,
        "preferred_currency": "EUR",
        "created_at": "2026-01-23T00:00:00Z",
        "updated_at": "2026-01-23T00:00:00Z"
    }])
    # Mock existing target hotel update
    mock_db.table().update().eq().eq().execute.return_value = MagicMock(data=[])
    # Mock query_logs insert
    mock_db.table().insert().execute.return_value = MagicMock(data=[])
    # Mock hotel_directory upsert
    mock_db.table().upsert().execute.return_value = MagicMock(data=[])

    print("--- Test 1: Creating hotel with EUR ---")
    await create_hotel(user_id, hotel_data, mock_db)
    
    # Verify insert call included preferred_currency
    insert_args = mock_db.table("hotels").insert.call_args[0][0]
    if insert_args.get("preferred_currency") == "EUR":
        print("PASS: preferred_currency 'EUR' passed to DB insert")
    else:
        print(f"FAIL: preferred_currency was {insert_args.get('preferred_currency')}")

    print("\n--- Test 2: Triggering monitor with EUR ---")
    # Setup mock for trigger_monitor
    mock_db.table("settings").select().eq().execute.return_value = MagicMock(data=[{
        "threshold_percent": 2.0,
        "currency": "USD" # User default is USD
    }])
    mock_db.table("hotels").select().eq().execute.return_value = MagicMock(data=[{
        "id": str(uuid4()),
        "name": "Test Currency Hotel",
        "location": "Paris, Fr",
        "is_target_hotel": True,
        "preferred_currency": "EUR"
    }])
    mock_db.table("price_logs").select().eq().order().limit().execute.return_value = MagicMock(data=[])
    
    with patch('backend.services.serpapi_client.fetch_hotel_price') as mock_fetch:
        mock_fetch.return_value = {
            "price": 150.0,
            "currency": "EUR",
            "vendor": "Booking.com"
        }
        
        await trigger_monitor(user_id, None, mock_db)
        
        # Verify SerpApi was called with EUR, not USD
        fetch_kwargs = mock_fetch.call_args[1]
        if fetch_kwargs.get("currency") == "EUR":
            print("PASS: SerpApi called with hotel-specific currency 'EUR'")
        else:
            print(f"FAIL: SerpApi called with {fetch_kwargs.get('currency')}")

if __name__ == "__main__":
    asyncio.run(test_hotel_currency_flow())
