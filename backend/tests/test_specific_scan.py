import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client
import sys

# Load environment variables FIRST
load_dotenv(".env")
load_dotenv(".env.local", override=True)

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from services.serpapi_client import serpapi_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

async def test_specific_hotel_scan(hotel_id):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Get hotel details
    hotel = supabase.table("hotels").select("*").eq("id", hotel_id).execute()
    if not hotel.data:
        print(f"Error: Hotel {hotel_id} not found")
        return
        
    h = hotel.data[0]
    print(f"\n--- Testing Scan for: {h['name']} ---")
    print(f"ID: {h['id']}")
    print(f"Token: {h['serp_api_id']}")
    print(f"Location: {h['location']}")
    
    try:
        price_data = await serpapi_client.fetch_hotel_price(
            hotel_name=h['name'],
            location=h['location'] or "Balikesir",
            currency=h.get('preferred_currency', 'USD'),
            serp_api_id=h['serp_api_id']
        )
        
        if price_data:
            print("\nSUCCESS!")
            print(f"Price: {price_data.get('price')} {price_data.get('currency')}")
            print(f"Vendor: {price_data.get('vendor')}")
            print(f"Rating: {price_data.get('rating')}")
            print(f"Stars: {price_data.get('stars')}")
        else:
            print("\nFAILURE: fetch_hotel_price returned None")
            
    except Exception as e:
        print(f"\nERROR during fetch: {e}")

if __name__ == "__main__":
    # Test for User 123e...'s Ramada
    # Based on diagnostic ID: e48ea45b-1574-4620-b84d-ba5e3186aa2e
    asyncio.run(test_specific_hotel_scan("e48ea45b-1574-4620-b84d-ba5e3186aa2e"))
