
import asyncio
import json
import os
from backend.services.provider_factory import ProviderFactory
from datetime import date, timedelta

async def debug_serpapi():
    print("--- Debugging SerpApi for Hilton Garden Inn Balikesir ---")
    
    # 1. Setup
    # Hilton ID from previous debug: "Hilton Garden Inn Balikesir"
    # We'll search by name to get a fresh result
    hotel_name = "Hilton Garden Inn Balikesir"
    location = "Balikesir, Turkey"
    
    # Dates: Tomorrow -> Day after
    check_in = date.today() + timedelta(days=1)
    check_out = date.today() + timedelta(days=2)
    
    provider = ProviderFactory.get_provider()
    print(f"Provider: {provider.get_provider_name()}")
    
    try:
        # 2. Fetch
        # We need the SerpApi ID if possible to be precise, let's use the one from DB if we had it, 
        # but for now let's let the provider search by name if it supports it, 
        # or defaults.
        # Actually, the provider fetch_price takes serp_api_id.
        # Let's hardcode the ID if we saw it in the logs? 
        # From previous logs: "5805afca-aa0d-4c19-92ea-45b83b10f1b8" (just guessing from the list, 
        # actually let's just search by name).
        
        print(f"Fetching for {check_in} -> {check_out}...")
        data = await provider.fetch_price(
            hotel_name=hotel_name,
            location=location,
            check_in=check_in,
            check_out=check_out,
            adults=2,
            currency="TRY"
        )
        
        print("--- RAW DATA EXTRACTED ---")
        print(json.dumps(data, indent=2, default=str))
        
        if data.get("price") == 0:
            print("\n❌ PRICE IS 0.0! Dumping keys in data to see what we got...")
            print(data.keys())
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_serpapi())
