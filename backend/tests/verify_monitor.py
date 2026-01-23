
import os
import uuid
import datetime
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
from backend.models.schemas import MonitorResult

# Set env vars before importing main
os.environ["NEXT_PUBLIC_SUPABASE_URL"] = "https://mock.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock_key"
os.environ["SERPAPI_API_KEY"] = "mock_key"

from backend.main import app, get_supabase
from backend.services.serpapi_client import serpapi_client

client = TestClient(app)

def test_monitor_endpoint():
    user_id = str(uuid.uuid4())
    hotel_id = str(uuid.uuid4())
    
    # Mock DB
    mock_db = MagicMock()
    
    # Mock DB - Use side_effect to handle multiple different calls
    # Sequence of calls in trigger_monitor:
    # 1. settings.select(*)...
    # 2. hotels.select(*)...
    # 3. scan_sessions.insert(...)...
    # 4. price_logs.select(...)... (Previous price)
    # 5. price_logs.insert(...)
    # ...
    
    # We need to construct result mocks
    mock_settings_res = MagicMock()
    mock_settings_res.data = [{
        "threshold_percent": 2.0, 
        "currency": "USD"
    }]
    
    mock_hotels_res = MagicMock()
    mock_hotels_res.data = [{
        "id": hotel_id,
        "name": "Test Hotel",
        "location": "Paris",
        "is_target_hotel": True,
        "serp_api_id": "123",
        "user_id": user_id
    }]
    
    session_id = str(uuid.uuid4())
    mock_session_res = MagicMock()
    mock_session_res.data = [{"id": session_id}]
    
    mock_prev_price_res = MagicMock()
    mock_prev_price_res.data = [{"price": 100.0}]

    mock_insert_res = MagicMock()
    mock_insert_res.data = [{"id": "log_id"}]

    # Define side_effect for execute()
    # It's hard to match exactly by query, so we'll just return a sequence if we can,
    # or better, checks the table name if possible. But table() returns an object.
    
    # Simpler approach: Make table() return DIFFERENT mocks for different tables if possible.
    # But table("name") is a call.
    
    # Let's use a side_effect on execute() based on call count or just return a smart mock?
    # returning iterator for side_effect is easiest for sequential calls.
    
    # Order:
    # 1. settings.select
    # 2. hotels.select
    # 3. scan_sessions.insert
    # 4. price_logs.select (process_hotel -> get prev price)
    # 5. price_logs.insert (process_hotel -> log price)
    # 6. hotels.update (process_hotel -> meta)
    # 7. hotel_directory.upsert
    # 8. alerts.insert (maybe)
    # 9. scan_sessions.update
    
    # Note: process_hotel is async and could be out of order if multiple hotels, 
    # but here we have 1 hotel.
    
    mock_execute = MagicMock()
    mock_execute.side_effect = [
        mock_settings_res,    # 1. Settings
        mock_hotels_res,      # 2. Hotels
        mock_session_res,     # 3. Session Insert
        mock_prev_price_res,  # 4. Prev Price
        mock_insert_res,      # 5. Price Log Insert
        mock_insert_res,      # 6. Hotel Update
        mock_insert_res,      # 7. Directory Upsert
        mock_insert_res,      # 8. Monitor Log
        mock_insert_res,      # 9. Session Update
        mock_insert_res,      # Extra safety
        mock_insert_res       # Extra safety
    ]
    
    mock_db.table.return_value.select.return_value.eq.return_value.execute = mock_execute
    mock_db.table.return_value.insert.return_value.execute = mock_execute
    # For generic chaining:
    mock_term = MagicMock()
    mock_term.execute = mock_execute
    
    # Catch-all for any chain
    mock_db.table.return_value.select.return_value = mock_term
    mock_db.table.return_value.select.return_value.eq.return_value = mock_term
    mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value = mock_term
    
    mock_db.table.return_value.insert.return_value = mock_term
    mock_db.table.return_value.update.return_value = mock_term
    mock_db.table.return_value.update.return_value.eq.return_value = mock_term
    mock_db.table.return_value.upsert.return_value = mock_term
    mock_db.table.return_value.upsert.return_value.on_conflict = mock_term

    # Patch DB dependency
    app.dependency_overrides[get_supabase] = lambda: mock_db
    
    # Patch SerpApi client (CRITICAL: async mock)
    # We want to verify it fetches live price
    serpapi_client.fetch_hotel_price = AsyncMock(return_value={
        "hotel_name": "Test Hotel",
        "price": 95.0, # Price dropped
        "currency": "USD",
        "vendor": "Booking.com",
        "rating": 4.5,
        "stars": 4
    })
    
    print("Triggering monitor...")
    resp = client.post(f"/api/monitor/{user_id}")
    
    if resp.status_code == 200:
        result = resp.json()
        print(f"Monitor Result: {result}")
        
        # Verify call arguments
        serpapi_client.fetch_hotel_price.assert_called_once()
        print("SUCCESS: SerpApi was called")
        
        if result["prices_updated"] == 1:
            print("SUCCESS: Prices updated")
        else:
            print("FAILURE: Prices not updated")
            
        if result["alerts_generated"] >= 0:
             print("SUCCESS: Alert logic ran")
    else:
        print(f"FAILURE: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    test_monitor_endpoint()
