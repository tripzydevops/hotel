"""
Booking.com Hotel Scraper using Scrape.do
Successfully extracts hotel names, prices, and ratings.
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
from bs4 import BeautifulSoup
from urllib.parse import quote, urlencode
import time
import re
from typing import List, Optional
from dataclasses import dataclass

# Your Scrape.do API Token
API_TOKEN = "1ea8a0c1790940088d5ee045f868f9f8647aa081c01"


@dataclass
class HotelResult:
    name: str
    price: str
    currency: str
    rating: Optional[str]
    review_count: Optional[str]
    source: str = "booking.com"


def scrape_booking_hotels(
    city: str,
    checkin: str,
    checkout: str,
    adults: int = 2,
    rooms: int = 1,
    currency: str = "TRY",
    star_rating: int = None  # Filter by star rating (3, 4, 5)
) -> List[HotelResult]:
    """
    Scrape hotel listings from Booking.com
    
    Args:
        city: City name to search (e.g., "Balikesir")
        checkin: Check-in date YYYY-MM-DD
        checkout: Check-out date YYYY-MM-DD
        adults: Number of adults
        rooms: Number of rooms
        currency: Preferred currency (TRY, USD, EUR)
        star_rating: Filter by star rating (3, 4, 5)
    
    Returns:
        List of HotelResult objects
    """
    # Build Booking.com URL
    params = {
        'ss': city,
        'checkin': checkin,
        'checkout': checkout,
        'group_adults': adults,
        'no_rooms': rooms,
        'group_children': 0,
        'selected_currency': currency
    }
    
    # Add star rating filter if specified
    if star_rating:
        params['nflt'] = f'class%3D{star_rating}'  # class=4 for 4-star
    
    target_url = f"https://www.booking.com/searchresults.html?{urlencode(params)}"
    
    # Build Scrape.do API URL - use US geo (Booking.com blocked in Turkey)
    encoded_url = quote(target_url)
    api_url = (
        f"https://api.scrape.do?token={API_TOKEN}"
        f"&url={encoded_url}"
        f"&render=true"
        f"&super=true"
        f"&geoCode=us"  # US IP - Booking.com blocked in Turkey
        f"&wait=3000"
    )
    
    print(f"🔍 Searching hotels in {city}...")
    print(f"📅 {checkin} to {checkout}")
    
    start_time = time.time()
    response = requests.get(api_url, timeout=120)
    elapsed = time.time() - start_time
    
    print(f"⏱️  Request took {elapsed:.2f}s (Status: {response.status_code})")
    
    if response.status_code != 200:
        print(f"❌ Failed: {response.text[:200]}")
        return []
    
    soup = BeautifulSoup(response.text, 'html.parser')
    hotels: List[HotelResult] = []
    
    # Find property cards
    property_cards = soup.select('[data-testid="property-card"]')
    print(f"📊 Found {len(property_cards)} hotels\n")
    
    for card in property_cards:
        # Extract hotel name
        name_el = card.select_one('[data-testid="title"]')
        name = name_el.get_text(strip=True) if name_el else "Unknown"
        
        # Extract price
        price_el = card.select_one('[data-testid="price-and-discounted-price"]')
        price_text = price_el.get_text(strip=True) if price_el else "N/A"
        
        # Parse price and currency
        price_match = re.search(r'([A-Z]{3}|₺|€|\$)\s*([\d,]+)', price_text)
        if price_match:
            currency_found = price_match.group(1)
            price_value = price_match.group(2)
        else:
            currency_found = "?"
            price_value = price_text
        
        # Extract rating
        rating_el = card.select_one('[data-testid="review-score"]')
        rating_text = rating_el.get_text(strip=True) if rating_el else None
        
        # Parse rating and review count
        rating = None
        review_count = None
        if rating_text:
            # Booking often repeats rating like '8.28.2'. Extract the first one.
            rating_match = re.search(r'(\d+\.\d+|\d+)', rating_text)
            review_match = re.search(r'(\d+)\s*reviews?', rating_text, re.I)
            
            if rating_match:
                rating = rating_match.group(1)
                # If it's a double rating like 8.28.2, it might match the whole thing or just 8.2
                # But (\d+\.\d+) is greedy. Let's ensure we get a clean number.
                if '.' in rating:
                    parts = rating.split('.')
                    if len(parts) > 2:
                        rating = f"{parts[0]}.{parts[1][0]}" # Assuming 8.28.2 -> 8.2
            
            review_count = review_match.group(1) if review_match else None
        
        hotel = HotelResult(
            name=name,
            price=price_value,
            currency=currency_found,
            rating=rating,
            review_count=review_count
        )
        hotels.append(hotel)
    
    return hotels


def main():
    # Test: Search Balikesir hotels
    hotels = scrape_booking_hotels(
        city="Balikesir, Turkey",
        checkin="2026-01-24",
        checkout="2026-01-25",
        currency="TRY"
    )
    
    print("=" * 60)
    print("HOTEL RESULTS")
    print("=" * 60)
    
    for i, hotel in enumerate(hotels, 1):
        print(f"\n{i}. {hotel.name}")
        print(f"   💰 {hotel.currency} {hotel.price}")
        if hotel.rating:
            print(f"   ⭐ {hotel.rating}/10 ({hotel.review_count or '?'} reviews)")
        print(f"   📍 Source: {hotel.source}")


if __name__ == "__main__":
    main()
