import httpx

API_URL = "http://127.0.0.1:8000"
MOCK_USER_ID = "123e4567-e89b-12d3-a456-426614174000"

# def test_health_check():
#     response = httpx.get(f"{API_URL}/")
#     assert response.status_code == 200

def test_get_analysis():
    response = httpx.get(f"{API_URL}/api/analysis/{MOCK_USER_ID}")
    assert response.status_code == 200
    data = response.json()
    assert "market_average" in data
    assert "market_min" in data
    assert "market_max" in data
    # Optional fields or fields that might be 0/null
    assert "competitive_rank" in data

def test_get_reports():
    response = httpx.get(f"{API_URL}/api/reports/{MOCK_USER_ID}")
    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    assert "weekly_summary" in data
    assert isinstance(data["sessions"], list)

def test_export_report():
    response = httpx.post(f"{API_URL}/api/reports/{MOCK_USER_ID}/export?format=csv")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "download_url" in data

if __name__ == "__main__":
    # Simple manual run
    # print("Testing health...")
    # test_health_check()
    print("Testing analysis endpoint...")
    test_get_analysis()
    print("Testing reports endpoint...")
    test_get_reports()
    print("Testing export endpoint...")
    test_export_report()
    print("All backend tests passed!")
