"""
Hotel Directory Population Script
Uses Booking.com to discover and populate hotel_directory table in Supabase
"""
import sys
import io
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import os
from dotenv import load_dotenv
from supabase import create_client
from booking_scraper import scrape_booking_hotels
from typing import List
import time

# Load environment variables from .env.local
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env.local'))

# Supabase config
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Turkish cities to scrape
TURKISH_CITIES = [
    "Istanbul",
    "Ankara", 
    "Izmir",
    "Antalya",
    "Balikesir",
    "Mugla",
    "Bodrum",
    "Fethiye",
    "Marmaris",
    "Cesme",
    "Kusadasi",
    "Alanya",
    "Side",
    "Kemer",
    "Cappadocia",
    "Trabzon",
    "Bursa",
    "Konya",
    "Pamukkale",
    "Kas",
]


def populate_hotel_directory(cities: List[str], limit_per_city: int = 20, star_rating: int = None):
    """
    Scrape hotels from Booking.com and add to hotel_directory
    
    Args:
        cities: List of city names to scrape
        limit_per_city: Max hotels per city (to conserve API calls)
        star_rating: Filter by star rating (3, 4, 5)
    """
    if not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_KEY environment variable")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    total_added = 0
    total_skipped = 0
    
    for city in cities:
        print(f"\n{'='*50}")
        print(f"Scraping {star_rating if star_rating else ''} star hotels in {city}, Turkey...")
        print('='*50)
        
        try:
            hotels = scrape_booking_hotels(
                city=f"{city}, Turkey",
                checkin="2026-02-01",  # Future date
                checkout="2026-02-02",
                adults=2,
                currency="TRY",
                star_rating=star_rating
            )
            
            for hotel in hotels[:limit_per_city]:
                # Check if hotel already exists
                existing = supabase.table('hotel_directory').select('id').ilike(
                    'name', f'%{hotel.name[:30]}%'
                ).execute()
                
                if existing.data:
                    print(f"  SKIP: {hotel.name[:40]} (already exists)")
                    total_skipped += 1
                    continue
                
                # Add to directory - only name and location for now
                hotel_data = {
                    'name': hotel.name,
                    'location': f"{city}, Turkey"
                }
                
                try:
                    supabase.table('hotel_directory').insert(hotel_data).execute()
                    print(f"  ADDED: {hotel.name[:40]}")
                    total_added += 1
                except Exception as e:
                    print(f"  ERROR adding {hotel.name[:30]}: {e}")
            
            # Rate limiting - wait between cities
            time.sleep(2)
            
        except Exception as e:
            print(f"  ERROR scraping {city}: {e}")
            continue
    
    print(f"\n{'='*50}")
    print("SUMMARY")
    print('='*50)
    print(f"Total hotels added: {total_added}")
    print(f"Total hotels skipped (duplicates): {total_skipped}")
    print(f"Cities processed: {len(cities)}")


def main():
    print("Hotel Directory Population Script")
    print("Using Booking.com to discover Turkish hotels")
    print()
    
    # Target: Balikesir region 5-star hotels
    test_cities = ["Balikesir", "Bandirma", "Edremit", "Akcay", "Ayvalik"]
    star_rating = 5
    
    print(f"Targeting {star_rating}-star hotels in: {test_cities}")
    print("(Set SUPABASE_KEY env var to enable database writes)")
    print()
    
    if not SUPABASE_KEY:
        print("DRY RUN - showing what would be scraped:")
        for city in test_cities:
            print(f"\n--- {city} ({star_rating} stars) ---")
            hotels = scrape_booking_hotels(
                city=f"{city}, Turkey",
                checkin="2026-02-01",
                checkout="2026-02-02",
                adults=2,
                currency="TRY",
                star_rating=star_rating
            )
            for h in hotels[:5]:
                print(f"  {h.name} | TL {h.price} | Rating: {h.rating}")
    else:
        populate_hotel_directory(test_cities, limit_per_city=20, star_rating=star_rating)


if __name__ == "__main__":
    main()
