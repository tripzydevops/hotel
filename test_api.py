
import requests
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_API_URL", "http://localhost:8000")
user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"

def run_test():
    print(f"Testing URL: {url}")
    try:
        r_ping = requests.get(f"{url}/api/ping")
        print(f"Ping Status: {r_ping.status_code}")
        print(f"Ping Body: {r_ping.text}")
        
        r_dash = requests.get(f"{url}/api/dashboard/{user_id}")
        print(f"Dashboard Status: {r_dash.status_code}")
        print(f"Dashboard Body: {r_dash.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_test()
