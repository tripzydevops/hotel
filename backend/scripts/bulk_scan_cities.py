"""
Bulk Hotel Scanner using SerpApi
Scrapes hotels from Google Hotels via SerpApi for specified Turkish cities and saves them to Supabase.
"""
import sys
import os
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import asyncio
from typing import List
from dotenv import load_dotenv

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

TARGET_CITIES = [
    "Istanbul",
    "Ankara",
    "Nigde",
    "Antalya",
    "Bodrum",
    "Izmir"
]

async def process_hotel_results(results: List[dict], default_location: str, dry_run: bool, tag: str):
    new_hotels = 0
    updated_hotels = 0
    
    if not results:
        return

    for hotel in results:
        name = hotel["name"]
        serp_api_id = hotel["serp_api_id"]
        location = hotel["location"]
        
        if not serp_api_id:
            continue
            
        if not location or location == "Unknown":
            location = default_location

        hotel_data = {
            "name": name,
            "location": location,
            "serp_api_id": serp_api_id,
            "stars": hotel.get("stars"),
            "rating": hotel.get("rating"),
            "amenities": hotel.get("amenities"),
            "images": hotel.get("images")
        }

        if dry_run:
            print(f"  [DRY RUN] Would save: {name} ({serp_api_id})")
            continue

        try:
            # Check if exists
            existing = supabase.table("hotel_directory").select("id, serp_api_id").eq("name", name).execute()
            
            if existing.data:
                # Always update metadata
                update_payload = {
                    "serp_api_id": serp_api_id,
                    "stars": hotel_data.get("stars"),
                    "rating": hotel_data.get("rating"),
                    "amenities": hotel_data.get("amenities"),
                    "images": hotel_data.get("images")
                }
                supabase.table("hotel_directory").update(update_payload).eq("id", existing.data[0]['id']).execute()
                updated_hotels += 1
                print(f"  [UPDATED] {name}")
            else:
                # Insert
                supabase.table("hotel_directory").insert(hotel_data).execute()
                new_hotels += 1
                print(f"  [NEW] {name}")
                
        except Exception as e:
            print(f"  [ERROR] {name}: {e}")

    if not dry_run:
        print(f"[{tag}] Summary: {new_hotels} new, {updated_hotels} updated.")


async def scan_city_by_stars(city: str, stars: int, limit: int = 50, dry_run: bool = False):
    print(f"\n[{city}] Scanning for {stars}-star hotels (Target: {limit})...")
    query = f"{stars} star hotels in {city}, Turkey"
    results = await serpapi_client.search_hotels(query, limit=limit)
    print(f"[{city} - {stars}*] Found {len(results)} hotels.")
    await process_hotel_results(results, f"{city}, Turkey", dry_run, f"{city} - {stars}*")


async def scan_custom_query(query: str, limit: int = 50, dry_run: bool = False):
    print(f"\n[Custom Scan] Query: '{query}' (Target: {limit})...")
    results = await serpapi_client.search_hotels(query, limit=limit)
    print(f"[Custom Scan] Found {len(results)} hotels.")
    # Default location is "Turkey" if unknown, or maybe derive from query?
    await process_hotel_results(results, "Turkey", dry_run, "Custom Scan")


async def main():
    import argparse
    parser = argparse.ArgumentParser(description='Bulk scan hotels from SerpApi')
    parser.add_argument('--dry-run', action='store_true', help='Scan without saving to DB')
    parser.add_argument('--limit', type=int, default=50, help='Max hotels per query')
    parser.add_argument('--city', type=str, help='Specific city to scan (optional)')
    parser.add_argument('--query', type=str, help='Custom search query (overrides city loop)')
    
    args = parser.parse_args()
    
    cities = [args.city] if args.city else TARGET_CITIES
    star_ratings = [4, 5]
    
    print("Starting Bulk Scan")
    print(f"Dry Run: {args.dry_run}")
    print("="*60)
    
    if args.query:
        await scan_custom_query(args.query, limit=args.limit, dry_run=args.dry_run)
    else:
        # City Loop Mode
        print(f"Cities: {', '.join(cities)}")
        print(f"Targeting Star Ratings: {star_ratings}")
        
        for city in cities:
            for stars in star_ratings:
                await scan_city_by_stars(city, stars, limit=args.limit, dry_run=args.dry_run)
                print("-" * 30)
            print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
