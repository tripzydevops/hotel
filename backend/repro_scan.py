import asyncio
import os
import sys
import logging
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load environment variables from .env
load_dotenv()

from backend.services.providers.dataforseo_provider import dataforseo_provider
from backend.services.insforge_client import insforge

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("repro_scan")

async def test_submission():
    # Get monitored hotels
    monitored_res = (
        insforge.table("user_hotels")
        .select("hotel_id, preferred_currency, hotels(id, name, location, property_token, serp_api_id, location_code, latitude, longitude, currency)")
        .eq("is_monitored", True)
        .execute()
    )
    
    if not monitored_res.data:
        print("No monitored hotels found.")
        return

    hotels_to_scan = []
    seen_hotels = set()
    for item in monitored_res.data:
        h = item.get("hotels")
        if not h or h.get("id") in seen_hotels:
            continue
        if h.get("property_token") or h.get("serp_api_id"):
            pref_currency = item.get("preferred_currency")
            if pref_currency:
                h["currency"] = pref_currency
            hotels_to_scan.append(h)
            seen_hotels.add(h["id"])

    print(f"Found {len(hotels_to_scan)} hotels to scan.")
    
    now = datetime.now(timezone.utc)
    
    # We won't actually create a session in DB to avoid mess, 
    # but we will call submit_hotel_scan_batch.
    
    print("Submitting to DataForSEO...")
    total = await dataforseo_provider.submit_hotel_scan_batch(
        insforge,
        hotels=hotels_to_scan,
        check_in=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
        check_out=(now + timedelta(days=2)).strftime("%Y-%m-%d"),
        deep_scan=False,
        session_id=None,
        currency="TRY"
    )
    
    print(f"Submission result: {total} tasks.")

if __name__ == "__main__":
    asyncio.run(test_submission())
