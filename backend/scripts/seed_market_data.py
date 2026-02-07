
import os
import sys
import random
from datetime import datetime, timedelta
from uuid import uuid4

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import get_supabase
import asyncio

CITIES = ["Istanbul", "Antalya", "Bodrum", "Izmir", "Fethiye"]
HOTEL_NAMES = [
    "Grand Resort", "Seaside Palace", "City Center Hotel", "Boutique Stay", 
    "Luxury Suites", "Budget Inn", "Holiday Resort", "Royal Plaza", 
    "Mountain View Lodge", "Ocean Breeze"
]

async def seed_data():
    print("Starting Seed Process...")
    supabase = get_supabase()
    
    # 1. Create Mock Admin User (if needed, but we assume one exists or we skip)
    # We'll use a hardcoded user_id for association if needed, or query one.
    user_result = supabase.table("profiles").select("id").limit(1).execute()
    if not user_result.data:
        print("No users found. Please sign up a user first.")
        return
    
    user_id = user_result.data[0]["id"]
    print(f"Attaching data to User ID: {user_id}")

    # 2. Seed Hotel Directory & Price Logs
    print("Seeding Hotels & Prices...")
    hotel_ids = []
    
    for i in range(25): # Generate 25 hotels
        city = random.choice(CITIES)
        name = f"{random.choice(HOTEL_NAMES)} {city} {random.randint(1, 99)}"
        
        # Create Hotel
        hotel_data = {
            "name": name,
            "location": f"{city}, Turkey",
            "stars": random.randint(3, 5),
            "rating": round(random.uniform(7.0, 9.8), 1),
            "description": f"A beautiful {random.randint(3,5)}-star hotel in the heart of {city}.",
            "amenities": ["Wi-Fi", "Pool", "Breakfast"],
            "images": [{"url": "https://placehold.co/600x400", "caption": "Main View"}]
        }
        
        # Try insert into hotel_directory first as base data
        res = supabase.table("hotel_directory").insert(hotel_data).execute()
        if res.data:
            h_id = res.data[0]["id"]
            hotel_ids.append(h_id)
            
            # Also add to 'hotels' table (Active Tracking) for this user to satisfy price_logs FK
            tracked_hotel = {
                "id": h_id,
                "user_id": user_id,
                "name": name,
                "location": f"{city}, Turkey",
                "stars": hotel_data["stars"],
                "rating": hotel_data["rating"],
                "is_target_hotel": random.choice([True, False]) if i == 0 else False
            }
            supabase.table("hotels").insert(tracked_hotel).execute()
            
            # 3. Generate Price Logs (History)
            price_logs = []
            base_price = random.randint(50, 500)
            
            for d in range(60): # last 60 days
                date_point = datetime.now() - timedelta(days=d)
                # Random trend + weekend spike
                multiplier = 1.2 if date_point.weekday() >= 5 else 1.0
                daily_price = base_price * multiplier * random.uniform(0.9, 1.1)
                
                price_logs.append({
                    "hotel_id": h_id,
                    "price": round(daily_price, 2),
                    "currency": "EUR",
                    "source": "booking.com",
                    "recorded_at": date_point.isoformat()
                })
            
            if price_logs:
                supabase.table("price_logs").insert(price_logs).execute()
                
    print(f"Created {len(hotel_ids)} hotels with price history.")
    
    # 4. Generate Mock Reports
    print("Generating Mock Reports...")
    try:
        if len(hotel_ids) >= 3:
            report_data = {
                "title": "Unittest Generated Report",
                "report_type": "comparison",
                "hotel_ids": hotel_ids[:3],
                "period_months": 3,
                "created_by": user_id,
                "report_data": {
                    "hotels": [{"name": "Mock Hotel A"}, {"name": "Mock Hotel B"}],
                    "ai_insights": ["Prices are trending up.", "Higher volatility in weekends."]
                }
            }
            supabase.table("reports").insert(report_data).execute()
            print("Successfully seeded mock report.")
    except Exception as e:
        print(f"Warning: Could not seed reports table (it may not exist yet). Error: {e}")
        print("Please ensure the 'reports' table is created using the SQL in backend/scripts/create_reports_table.py")

    print("Seeding Complete!")

if __name__ == "__main__":
    asyncio.run(seed_data())
