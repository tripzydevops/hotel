
import asyncio
import random

# Mocking the Environment
from typing import List, Dict, Any

async def mock_fetch_hotel_price(hotel_name, **kwargs):
    print(f"[Network] Fetching {hotel_name}...")
    await asyncio.sleep(random.uniform(0.5, 1.5)) # Simulate network delay
    
    # Simulate a random failure for one hotel
    if "Ramada" in hotel_name:
        # raise Exception("Simulated SerpApi Crash") # Uncomment to test crash
        pass
        
    print(f"[Network] Done {hotel_name}")
    return {"price": 100, "hotel_name": hotel_name}

async def run_monitor_simulation(hotels: List[Dict[str, Any]]):
    print(f"Starting Scan for {len(hotels)} hotels")
    
    semaphore = asyncio.Semaphore(3)
    prices_updated = 0
    errors = []

    async def process_hotel(hotel):
        nonlocal prices_updated
        async with semaphore:
            hotel_name = hotel["name"]
            print(f"[Start] Processing {hotel_name}")
            
            try:
                # Simulate Logic
                if not hotel.get("serp_api_id"):
                    print(f"[Monitor] No token for {hotel_name}. Running acquisition search...")
                    # Simulate simple logic flow
                
                # Fetch Real Price (Mocked)
                price_data = await mock_fetch_hotel_price(hotel_name)
                
                if not price_data:
                    print(f"[Monitor] Not Found: {hotel_name}")
                    return

                prices_updated += 1
                print(f"[Success] Updated {hotel_name}")
                
            except Exception as e:
                print(f"[Error] Task failed for {hotel_name}: {e}")
                errors.append(str(e))
                # IMPORTANT: Does this exception kill the gather?
                # If we catch it here, it shouldn't. 
                # But if it bubbles up from semaphore acquisition...

    # The Logic in main.py:
    # await asyncio.gather(*[process_hotel(hotel) for hotel in hotels])
    
    print("Launching tasks...")
    try:
        await asyncio.gather(*[process_hotel(hotel) for hotel in hotels])
    except Exception as e:
        print(f"[CRITICAL] Main Loop Crash: {e}")

    print(f"Scan Completed. Updated: {prices_updated}. Errors: {len(errors)}")

# Mock Data
hotels = [
    {"id": "1", "name": "Willmont Hotel", "serp_api_id": "123"},
    {"id": "2", "name": "Ramada Residences", "serp_api_id": "456"},
    {"id": "3", "name": "Hilton Garden Inn", "serp_api_id": "789"},
    {"id": "4", "name": "Altin Otel", "serp_api_id": None}, # Missing Token
]

if __name__ == "__main__":
    asyncio.run(run_monitor_simulation(hotels))
