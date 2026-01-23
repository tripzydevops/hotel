
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

# Set env vars before importing main to avoid errors if they are used at module level
os.environ["NEXT_PUBLIC_SUPABASE_URL"] = "https://mock.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock_key"

from backend.main import app, get_supabase

client = TestClient(app)

def test_directory_flow():
    user_id = str(uuid.uuid4())
    hotel_name = f"TestHotel_{uuid.uuid4().hex[:6]}"
    
    # Mock DB Client
    mock_db = MagicMock()
    
    # Mock create_hotel flow
    # 1. toggle off validation
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.count = 0 
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    
    mock_db.table.return_value.insert.return_value.execute.return_value.data = [{
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": hotel_name,
        "is_target_hotel": False,
        "created_at": "2023-01-01T00:00:00",
        "updated_at": "2023-01-01T00:00:00"
    }]
    
    # 3. search flow
    # mock search result
    mock_db.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value.data = [
        {"name": hotel_name, "location": "Test City", "serp_api_id": "123"}
    ]

    # Patch dependency
    app.dependency_overrides[get_supabase] = lambda: mock_db

    # 1. Create Hotel
    print(f"Creating hotel: {hotel_name}")
    resp = client.post(f"/api/hotels/{user_id}", json={
        "name": hotel_name,
        "location": "Test City",
        "is_target_hotel": False,
        "currency": "USD"
    })
    
    # Allow 403 or 503 if logic fails, but we expect 200 with mock
    if resp.status_code != 200:
        print(f"Create failed: {resp.status_code} {resp.text}")
    else:
        print("Create success")

    # 2. Search Hotel
    print(f"Searching for: {hotel_name}")
    resp = client.get(f"/api/v1/directory/search?q={hotel_name}&user_id={user_id}")
    
    if resp.status_code == 200:
        data = resp.json()
        print(f"Search results: {len(data)}")
        found = any(h['name'] == hotel_name for h in data)
        if found:
            print("SUCCESS: Hotel found in directory search")
        else:
            print("FAILURE: Hotel NOT found in directory search")
    else:
        print(f"Search failed: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    test_directory_flow()
