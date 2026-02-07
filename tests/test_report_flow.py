import os
import requests
import json
from datetime import datetime

# Configuration
API_URL = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:8000")

def test_market_intelligence():
    print("Testing Market Intelligence endpoint...")
    try:
        headers = {"X-Dev-Bypass": "tripzy-secret-2025"}
        res = requests.get(f"{API_URL}/api/admin/market-intelligence?city=Istanbul", headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            print(f"[SUCCESS] Found {data['summary']['hotel_count']} hotels in Istanbul.")
            return data["hotels"]
        else:
            print(f"[FAIL] {res.status_code} - {res.text}")
            return None
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return None

def test_report_generation(hotel_ids):
    if not hotel_ids:
        print("[SKIP] No hotel IDs provided.")
        return

    print(f"Testing Report Generation for hotels: {hotel_ids[:3]}...")
    payload = {
        "hotel_ids": hotel_ids[:1],
        "period_months": 3,
        "title": f"Test Report {datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "comparison_mode": False
    }
    
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Dev-Bypass": "tripzy-secret-2025"
        }
        res = requests.post(f"{API_URL}/api/admin/reports/generate", json=payload, headers=headers, timeout=30)
        
        if res.status_code == 200:
            data = res.json()
            print(f"[SUCCESS] Report Generated! ID: {data.get('report_id')}")
            return data.get('report_id')
        elif res.status_code == 401:
            print("[AUTH] Unauthorized: Need a valid admin token.")
            return "AUTH_REQUIRED"
        else:
            print(f"[FAIL] {res.status_code} - {res.text}")
            return None
    except Exception as e:
        print(f"[ERROR] {e}")
        return None

if __name__ == "__main__":
    hotels = test_market_intelligence()
    if hotels:
        ids = [str(h["id"]) for h in hotels]
        test_report_generation(ids)
    else:
        print("Could not fetch hotels - check if server is running on " + API_URL)
