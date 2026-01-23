import httpx
import json

API_URL = "http://127.0.0.1:8000"
# This is the user ID that actually has monitoring logs in the DB
REAL_USER_ID = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"

def test_legacy_recovery():
    print(f"Testing legacy recovery for user {REAL_USER_ID}...")
    response = httpx.get(f"{API_URL}/api/reports/{REAL_USER_ID}")
    
    if response.status_code != 200:
        print(f"Error: Status code {response.status_code}")
        print(response.text)
        return

    data = response.json()
    sessions = data.get("sessions", [])
    
    print(f"Found {len(sessions)} sessions.")
    
    legacy_sessions = [s for s in sessions if s.get("session_type") == "legacy"]
    print(f"Found {len(legacy_sessions)} legacy (synthesized) sessions.")
    
    if legacy_sessions:
        for s in legacy_sessions:
            print(f" - Session ID: {s['id']}, Hotels: {s['hotels_count']}, Created: {s['created_at']}")
        print("Success: Legacy scans recovered.")
    else:
        print("Failure: No legacy sessions found.")

if __name__ == "__main__":
    test_legacy_recovery()
