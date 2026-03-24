import asyncio
import os
from datetime import date, timedelta
from dotenv import load_dotenv
from backend.services.providers.dataforseo_provider import DataForSEOProvider

async def run_demo():
    load_dotenv()
    provider = DataForSEOProvider()
    
    hotels = [
        {"name": "Ramada Resort Kazdaglari Thermal and Spa", "location": "Balikesir, Turkey"},
        {"name": "Ramada Residences By Wyndham Balikesir", "location": "Balikesir, Turkey"},
        {"name": "Willmont Hotel", "location": "Balikesir, Turkey"},
        {"name": "Hilton Garden Inn Balikesir", "location": "Balikesir, Turkey"},
        {"name": "Altın Otel", "location": "Balikesir, Turkey"}
    ]
    
    check_in = date.today() + timedelta(days=7)
    check_out = check_in + timedelta(days=1)
    
    print(f"🚀 Starting DataForSEO Demo Scan (Standard Queue)")
    print(f"📅 Dates: {check_in} to {check_out}")
    print("-" * 50)
    
    # We'll run them in parallel to save time (DataForSEO handles concurrent tasks well)
    tasks = []
    for h in hotels:
        print(f"📝 Queueing task for: {h['name']}...")
        tasks.append(provider.fetch_price(
            hotel_name=h['name'],
            location=h['location'],
            check_in=check_in,
            check_out=check_out,
            currency="TRY"
        ))
    
    results = await asyncio.gather(*tasks)
    
    print("\n" + "="*50)
    print("SERP RESULTS (DATAFORSEO)")
    print("="*50)
    
    for i, res in enumerate(results):
        hotel_name = hotels[i]['name']
        if res and res.get("status") == "success":
            print(f"✅ {hotel_name}: {res['price']} {res['currency']} (via {res['vendor']})")
            print(f"   ⭐ Rating: {res['rating']} ({res['reviews']} reviews)")
            print(f"   🔗 Task ID: {res['task_id']}")
        else:
            print(f"❌ {hotel_name}: Error - {res.get('error') or res.get('message', 'Unknown error')}")
        print("-" * 30)

if __name__ == "__main__":
    asyncio.run(run_demo())
