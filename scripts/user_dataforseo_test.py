import os
import time
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

# Config: set these environment variables or replace with literals (not recommended)
API_USER = os.getenv("DATAFORSEO_LOGIN")
API_PASS = os.getenv("DATAFORSEO_PASSWORD")

if not API_USER or not API_PASS:
    raise SystemExit("Please set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables.")

BASE_URL = "https://api.dataforseo.com/v3/business_data/google"
TASK_POST_URL = f"{BASE_URL}/hotel_searches/task_post"
# We'll use GET /task_get/<id> to retrieve results
TASK_GET_URL_TEMPLATE = f"{BASE_URL}/hotel_searches/task_get/{{task_id}}"

# Example task body (customize as needed)
task_payload = [
    {
        "location_name": "Balikesir, Turkey",
        "keyword": "Willmont Hotel",
        "check_in": "2026-03-28",
        "check_in": "2026-03-28",
        "check_out": "2026-03-29",
        "currency": "TRY",
        "adults": 2,
        "device": "desktop",
        "os": "windows",
        "language_name": "English",
        "depth": 20,        
        "tag": "willmont_check"
    }
]

def post_task(payload):
    resp = requests.post(
        TASK_POST_URL,
        auth=HTTPBasicAuth(API_USER, API_PASS),
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60
    )
    resp.raise_for_status()
    return resp.json()

def get_task_results(task_id):
    url = TASK_GET_URL_TEMPLATE.format(task_id=task_id)
    resp = requests.get(
        url,
        auth=HTTPBasicAuth(API_USER, API_PASS),
        timeout=60
    )
    resp.raise_for_status()
    return resp.json()

def extract_prices_from_result(result_obj):
    hotels = []
    for block in result_obj:
        items = block.get("items", [])
        for itm in items:
            if itm.get("type") != "hotel_search_item":
                continue
            title = itm.get("title")
            prices = itm.get("prices") or {}
            price = prices.get("price")
            currency = prices.get("currency")
            discount = prices.get("discount_text")
            check_in = prices.get("check_in")
            check_out = prices.get("check_out")
            visitors = prices.get("visitors")
            hotels.append({
                "title": title,
                "price": price,
                "currency": currency,
                "discount_text": discount,
                "check_in": check_in,
                "check_out": check_out,
                "visitors": visitors,
                "raw_prices": prices
            })
    return hotels

def main():
    print("Posting hotel search task...")
    try:
        post_response = post_task(task_payload)
    except Exception as e:
        print(f"Error posting task: {e}")
        return

    tasks = post_response.get("tasks", [])
    if not tasks:
        print("No tasks returned in the POST response.")
        return

    task = tasks[0]
    task_id = task.get("id")
    task_status = task.get("status_message", "")
    print(f"Task created. ID: {task_id}, status: {task_status}")

    max_attempts = 100
    attempt = 0
    sleep_seconds = 10

    print("Polling for results...")
    while attempt < max_attempts:
        attempt += 1
        try:
            resp = get_task_results(task_id)
        except Exception as e:
            print(f"Error fetching results: {e}")
            time.sleep(sleep_seconds)
            continue

        tasks = resp.get("tasks", [])
        if not tasks:
            time.sleep(sleep_seconds)
            continue

        t = tasks[0]
        status_code = t.get("status_code")
        status_msg = t.get("status_message", "")
        print(f"Attempt {attempt}: status_code={status_code} ({status_msg})")

        if status_code == 20000:
            result = t.get("result") or []
            hotels = extract_prices_from_result(result)
            if not hotels:
                print("No hotel items found.")
            else:
                print(f"Found {len(hotels)} hotels:")
                for h in hotels[:10]:
                    print(f"- {h['title']}: {h['price']} {h['currency']}")
            return
        elif status_code == 40402:
            print(f"Task Failed: {status_msg}")
            return
        else:
            time.sleep(sleep_seconds)

if __name__ == "__main__":
    main()
