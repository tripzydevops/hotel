import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from supabase import create_client
from dotenv import load_dotenv

load_dotenv(".env.local")

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials in .env.local")
    sys.exit(1)

supabase = create_client(url, key)

async def inject_dummy_sentiment():
    print("Injecting dummy sentiment data...")
    
    # 1. Get first hotel (User's target)
    # We assume the user has at least one hotel.
    hotels = supabase.table("hotels").select("*").limit(1).execute()
    if not hotels.data:
        print("No hotels found!")
        return

    target_id = hotels.data[0]["id"]
    print(f"Target Hotel ID: {target_id}")

    # 2. Dummy Data
    dummy_data = [
        {"name": "Cleanliness", "total_mentioned": 150, "positive": 130, "negative": 5, "neutral": 15, "description": "Cleanliness & Hygiene"},
        {"name": "Service", "total_mentioned": 85, "positive": 60, "negative": 15, "neutral": 10, "description": "Staff & Service Quality"},
        {"name": "Location", "total_mentioned": 200, "positive": 190, "negative": 2, "neutral": 8, "description": "Location & Accessibility"},
        {"name": "Amenities", "total_mentioned": 45, "positive": 20, "negative": 20, "neutral": 5, "description": "Pool & Facilities"}
    ]

    # 3. Update
    res = supabase.table("hotels").update({"sentiment_breakdown": dummy_data}).eq("id", target_id).execute()
    print("Update successful:", res.data)
    print("\nDONE! Please refresh your Analysis page.")

if __name__ == "__main__":
    asyncio.run(inject_dummy_sentiment())
