import os
import sys
import json
import requests
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

def dump_price_logs():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials missing.")
        return

    # Use raw REST API for speed
    endpoint = f"{url}/rest/v1/price_logs?limit=5"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    print(f"Fetching from {endpoint}...")
    try:
        response = requests.get(endpoint, headers=headers)
        if response.status_code == 200:
            data = response.json()
            with open("price_logs_dump.json", "w") as f:
                json.dump(data, f, indent=2)
            print("Done. Saved to price_logs_dump.json")
            if data:
                print(f"Found keys: {list(data[0].keys())}")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_price_logs()
