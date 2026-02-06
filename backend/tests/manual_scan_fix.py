import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client
import sys
from datetime import date

# Load environment variables FIRST
load_dotenv(".env")
load_dotenv(".env.local", override=True)

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from services.serpapi_client import serpapi_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

async def force_full_scan(user_id):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Get all hotels for user
    hotels_result = supabase.table("hotels").select("*").eq("user_id", user_id).execute()
    hotels = hotels_result.data or []
    
    print(f"\n--- FORCING FULL SCAN FOR USER: {user_id} ---")
    print(f"Found {len(hotels)} hotels.")
    
    for h in hotels:
        name = h['name']
        print(f"\nScanning: {name}...")
        
        try:
            price_data = await serpapi_client.fetch_hotel_price(
                hotel_name=name,
                location=h.get('location') or "Balikesir",
                currency=h.get('preferred_currency') or "USD",
                serp_api_id=h.get('serp_api_id')
            )
            
            if price_data:
                # Log to price_logs
                log_data = {
                    "hotel_id": h['id'],
                    "price": price_data['price'],
                    "currency": price_data.get('currency', 'USD'),
                    "check_in_date": date.today().isoformat(),
                    "source": "serpapi",
                    "vendor": price_data.get('vendor')
                }
                supabase.table("price_logs").insert(log_data).execute()
                
                # Update hotel meta
                meta = {
                    "rating": price_data.get("rating"),
                    "stars": price_data.get("stars"),
                    "image_url": price_data.get("image_url")
                }
                # Remove None values
                meta = {k: v for k, v in meta.items() if v is not None}
                if meta:
                    supabase.table("hotels").update(meta).eq("id", h['id']).execute()
                
                print(f"  SUCCESS: {price_data['price']} via {price_data.get('vendor')}")
            else:
                print(f"  FAILED: No data returned from SerpApi for {name}")
                
        except Exception as e:
            print(f"  ERROR processing {name}: {e}")

if __name__ == "__main__":
    # Target User 123e4567-e89b-12d3-a456-426614174000
    asyncio.run(force_full_scan("123e4567-e89b-12d3-a456-426614174000"))
