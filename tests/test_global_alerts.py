import asyncio
import os
from uuid import UUID
from dotenv import load_dotenv
from backend.utils.db import get_supabase
from backend.agents.analyst_agent import AnalystAgent
from datetime import datetime, date

# Load environment variables
load_dotenv()

async def test_global_pulse():
    print("--- Starting Global Pulse Verification ---")
    db = get_supabase()
    if not db:
        print("Error: Could not connect to Supabase.")
        return

    analyst = AnalystAgent(db)
    target_serp_id = "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE"

    # 1. Find trackers
    trackers_res = db.table("hotels").select("user_id, id, name").eq("serp_api_id", target_serp_id).execute()
    trackers = trackers_res.data
    
    if len(trackers) < 2:
        print(f"Error: Not enough trackers for {target_serp_id}. Found: {len(trackers)}")
        return

    initiator = trackers[0]
    ghost = trackers[1]
    
    print(f"Initiator: User {initiator['user_id']} (Hotel: {initiator['name']})")
    print(f"Ghost: User {ghost['user_id']} (Hotel: {ghost['name']})")

    # 2. Add a historical price log for Ghost if missing (to ensure we have a comparison point)
    # We want to simulate a price drop. Let's say Ghost's last price was 1000.
    test_old_price = 1000.0
    print(f"Setting mock historical price for Ghost: {test_old_price}")
    db.table("price_logs").insert({
        "hotel_id": ghost["id"],
        "price": test_old_price,
        "currency": "TRY",
        "check_in_date": str(date.today()),
        "recorded_at": (datetime.now()).isoformat()
    }).execute()

    # 3. Simulate a scan for Initiator with a DROPPED price (e.g., 500)
    current_price = 500.0
    print(f"Simulating scan for Initiator with price: {current_price}")
    
    scraper_results = [
        {
            "hotel_id": initiator["id"],
            "hotel_name": initiator["name"],
            "status": "success",
            "price_data": {
                "price": current_price,
                "currency": "TRY",
                "property_token": target_serp_id,
                "vendor": "TestVendor",
                "source": "serpapi"
            },
            "check_in": date.today()
        }
    ]

    # Run analysis
    await analyst.analyze_results(
        user_id=UUID(initiator["user_id"]),
        scraper_results=scraper_results,
        threshold=2.0
    )

    # 4. Wait a bit for the background task to complete
    print("Waiting for global pulse pulse...")
    await asyncio.sleep(5)

    # 5. Verify alert creation for GHOST user
    alerts_res = db.table("alerts").select("*").eq("user_id", ghost["user_id"]).order("created_at", desc=True).limit(1).execute()
    
    if alerts_res.data:
        latest_alert = alerts_res.data[0]
        if "[Global Pulse]" in latest_alert["message"]:
            print("SUCCESS: Global Pulse Alert detected!")
            print(f"Alert Message: {latest_alert['message']}")
            print(f"Price: {latest_alert['old_price']} -> {latest_alert['new_price']}")
        else:
            print(f"FAILURE: Latest alert is not a Global Pulse alert. Msg: {latest_alert['message']}")
    else:
        print("FAILURE: No alert found for Ghost user.")

if __name__ == "__main__":
    asyncio.run(test_global_pulse())
