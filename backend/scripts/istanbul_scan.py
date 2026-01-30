"""
Istanbul Neighborhood Scanner
Targeting specific high-density tourist districts in Istanbul.
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

# Key neighborhoods that function like distinct markets
NEIGHBORHOODS = [
    "Sultanahmet",  # Historic center
    "Taksim",       # Modern center
    "Karakoy",      # Trendy/Hip
    "Galata",       # Tourist/Tower area
    "Besiktas",     # Luxury/Bosphorus
    "Kadikoy",      # Asian side hub
    "Sisli",        # Business/Luxury
    "Nisantasi",    # Luxury Shopping
    "Balat",        # Historic/Trendy
    "Ortakoy"       # Bosphorus/Bridge
]

async def process_results(results, location_tag):
    new_count = 0
    updated_count = 0
    
    if not results:
        return 0, 0

    for hotel in results:
        name = hotel["name"]
        serp_api_id = hotel["serp_api_id"]
        # Use existing provided location, or default to Istanbul tag if missing
        location = hotel.get("location")
        if not location or location == "Unknown":
            location = f"Istanbul ({location_tag}), Turkey"

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

async def scan_neighborhood(neighborhood: str):
    query = f"Hotels in {neighborhood}, Istanbul"
    print(f"\n[Zone Scan] Searching for '{neighborhood}'...")
    
    try:
        # Limit 25 is enough to get the core of a neighborhood
        results = await serpapi_client.search_hotels(query, limit=25)
        print(f"[{neighborhood}] Found {len(results)} results.")
        
        new_c, upd_c = await process_results(results, neighborhood)
        print(f"[{neighborhood}] Summary: {new_c} new, {upd_c} updated.")
        
    except Exception as e:
        print(f"[{neighborhood}] Failed: {e}")

async def main():
    print(f"Starting Istanbul Neighborhood Scan.")
    print(f"Zones: {', '.join(NEIGHBORHOODS)}")
    print("=" * 60)
    
    for zone in NEIGHBORHOODS:
        await scan_neighborhood(zone)
        # Small pause
        await asyncio.sleep(1)
        
    print("=" * 60)
    print("Neighborhood Scan Complete.")

if __name__ == "__main__":
    asyncio.run(main())
