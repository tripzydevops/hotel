"""
Brand Scan Script
Scans for specific major hotel chains in Turkey to ensure high-value coverage.
"""
import sys
import os
import io
import asyncio
from dotenv import load_dotenv

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add project root directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.services.serpapi_client import serpapi_client
from supabase import create_client

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env.local'))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BRANDS = [
    "Hilton",
    "Wyndham",
    "Marriott",
    "Swissotel",
    "Rixos",
    "Radisson",
    "Sheraton",
    "Kempinski",
    "Dedeman"
]

async def process_results(results, tag):
    new_count = 0
    updated_count = 0
    
    if not results:
        return 0, 0

    for hotel in results:
        name = hotel["name"]
        serp_api_id = hotel["serp_api_id"]
        location = hotel["location"]
        
        if not serp_api_id:
            continue
            
        if not location or location == "Unknown":
            location = "Turkey"

        hotel_data = {
            "name": name,
            "location": location,
            "serp_api_id": serp_api_id,
            "stars": hotel.get("stars"),
            "rating": hotel.get("rating"),
            "amenities": hotel.get("amenities"),
            "images": hotel.get("images")
        }

        try:
            existing = supabase.table("hotel_directory").select("id").eq("name", name).execute()
            
            if existing.data:
                # Update useful metadata
                payload = {
                    "serp_api_id": serp_api_id,
                    "stars": hotel_data.get("stars"),
                    "rating": hotel_data.get("rating"),
                    "amenities": hotel_data.get("amenities"),
                    "images": hotel_data.get("images")
                }
                supabase.table("hotel_directory").update(payload).eq("id", existing.data[0]['id']).execute()
                updated_count += 1
                print(f"  [UPDATED] {name}")
            else:
                # Insert
                supabase.table("hotel_directory").insert(hotel_data).execute()
                new_count += 1
                print(f"  [NEW] {name}")
                
        except Exception as e:
            print(f"  [ERROR] {name}: {e}")
            
    return new_count, updated_count

async def scan_brand(brand: str):
    query = f"{brand} hotels in Turkey"
    print(f"\n[Brand Scan] Searching for '{brand}'...")
    
    try:
        # Use limit=50 to capture most of the brand's presence
        results = await serpapi_client.search_hotels(query, limit=50)
        print(f"[{brand}] Found {len(results)} results.")
        
        new_c, upd_c = await process_results(results, brand)
        print(f"[{brand}] Summary: {new_c} new, {upd_c} updated.")
        
    except Exception as e:
        print(f"[{brand}] Failed: {e}")

async def main():
    print(f"Starting Brand Scan for: {', '.join(BRANDS)}")
    print("=" * 60)
    
    for brand in BRANDS:
        await scan_brand(brand)
        await asyncio.sleep(1) # Polite delay
        
    print("=" * 60)
    print("Brand Scan Complete.")

if __name__ == "__main__":
    asyncio.run(main())
