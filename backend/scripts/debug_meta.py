
import os
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def debug_dashboard():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase = create_client(url, key)
    
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    
    # Simulate get_dashboard logic
    print(f"Fetching hotels for user: {user_id}")
    hotels_result = supabase.table("hotels").select("*").eq("user_id", user_id).execute()
    hotels = hotels_result.data or []
    
    print(f"Found {len(hotels)} hotels.")
    for hotel in hotels:
        print(f"\nHotel: {hotel['name']}")
        print(f"  Rating: {hotel.get('rating')}")
        print(f"  Stars: {hotel.get('stars')}")
        print(f"  Image: {hotel.get('image_url')}")
        print(f"  Is Target: {hotel.get('is_target_hotel')}")

if __name__ == "__main__":
    debug_dashboard()
