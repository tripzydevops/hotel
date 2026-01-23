import sys
import os
import asyncio
from uuid import uuid4
from unittest.mock import MagicMock, patch, AsyncMock

# Add root to path
sys.path.append(os.getcwd())

from backend.main import create_hotel, trigger_monitor
from backend.models.schemas import HotelCreate

import pytest

@pytest.mark.asyncio
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
    
    # Setup chain for insert
    # db.table("hotels").insert(...).execute() -> returns object with data
    mock_insert_return = MagicMock(data=[{
        "id": str(uuid4()),
        "user_id": str(user_id),
        "name": "Test Currency Hotel",
        "location": "Paris, Fr",
        "is_target_hotel": True,
        "preferred_currency": "EUR",
        "created_at": "2026-01-23T00:00:00Z",
        "updated_at": "2026-01-23T00:00:00Z"
    }])
    
    mock_table_return = MagicMock()
    mock_table_return.insert.return_value.execute.return_value = mock_insert_return
    
    # Handle update calls too (for is_target_hotel=True)
    mock_table_return.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    
    # Handle upsert for directory sync
    mock_table_return.upsert.return_value.execute.return_value = MagicMock(data=[])

    # Handle select calls (for Test 2)
    # We need to dynamically return data based on table name?
    # This is hard because table() returns the SAME mock.
    # So we can't easily differentiate table("settings").select() from table("hotels").select()
    # unless we use side_effect on table().
    # But for a simple fix, let's just make select()...execute() return data that satisfies trigger_monitor
    
    mock_select_execute = MagicMock()
    # Settings data
    mock_select_execute.data = [{
        "threshold_percent": 2.0,
        "currency": "USD"
    }]
    # Hotels data (if it iterates)
    # Wait, trigger_monitor calls select on settings, then select on hotels, then select on price_logs.
    # If we return the SAME mock for all, we must ensure it behaves safely.
    
    # Let's switch to side_effect for table() to distinguish tables
    
    # Store the generic table mock for hotels
    hotels_table_mock = mock_table_return
    
    # Configure select on hotels table too
    hotels_table_mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
        "id": str(uuid4()),
        "name": "Test Currency Hotel",
        "location": "Paris, Fr",
        "is_target_hotel": True,
        "preferred_currency": "EUR"
    }])
    
    settings_table_mock = MagicMock()
    settings_table_mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
        "threshold_percent": 2.0,
        "currency": "USD"
    }])
    
    price_logs_table_mock = MagicMock()
    price_logs_table_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

    def table_side_effect(name):
        if name == "hotels":
            return hotels_table_mock
        elif name == "settings":
            return settings_table_mock
        elif name == "price_logs":
            return price_logs_table_mock
        elif name == "hotel_directory": # create_hotel uses this
            return hotels_table_mock # re-use or new
        return MagicMock()

    mock_db.table.side_effect = table_side_effect
    
    # We removed mock_db.table.return_value assignment in favor of side_effect


    print("--- Test 1: Creating hotel with EUR ---")
    await create_hotel(user_id, hotel_data, mock_db)
    
    # Verify insert call included preferred_currency
    # Access via the generic table mock since we know it's used for inserting
    if hotels_table_mock.insert.called:
        insert_args = hotels_table_mock.insert.call_args[0][0]
        if insert_args.get("preferred_currency") == "EUR":
            print("PASS: preferred_currency 'EUR' passed to DB insert")
        else:
            print(f"FAIL: preferred_currency was {insert_args.get('preferred_currency')}")
    else:
        print("FAIL: db.table().insert() was NOT called")

    print("\n--- Test 2: Triggering monitor with EUR ---")
    with patch('backend.services.serpapi_client.SerpApiClient.fetch_hotel_price', new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = {
            "price": 150.0,
            "currency": "EUR",
            "vendor": "Booking.com"
        }
        
        await trigger_monitor(user_id, None, mock_db)
        
        # Verify SerpApi was called
        if mock_fetch.called:
            fetch_kwargs = mock_fetch.call_args[1]
            if fetch_kwargs.get("currency") == "EUR":
                print("PASS: SerpApi called with hotel-specific currency 'EUR'")
            else:
                print(f"FAIL: SerpApi called with {fetch_kwargs.get('currency')}")
        else:
            print("FAIL: fetch_hotel_price was NOT called (Monitor logic skipped?)")
            
            # Debug: Check if settings/hotels returned data
            print(f"DEBUG: Settings call count: {settings_table_mock.select.call_count}")
            print(f"DEBUG: Hotels call count: {hotels_table_mock.select.call_count}")

if __name__ == "__main__":
    asyncio.run(test_hotel_currency_flow())
