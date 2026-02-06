import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
import time
import re

# Your Scrape.do API Token
API_TOKEN = "1ea8a0c1790940088d5ee045f868f9f8647aa081c01"

# Booking.com - typically works without login
# Balikesir, Turkey - checkin tomorrow, 1 night
target_url = "https://www.booking.com/searchresults.html?ss=Balikesir&checkin=2026-01-24&checkout=2026-01-25&group_adults=2&no_rooms=1&group_children=0"

print("🚀 Testing Booking.com (no login required)...")
print(f"Target: {target_url}")

encoded_url = quote(target_url)
api_url = f"https://api.scrape.do?token={API_TOKEN}&url={encoded_url}&render=true&super=true&wait=5000"

start_time = time.time()

try:
    response = requests.get(api_url, timeout=120)
    elapsed = time.time() - start_time
    print(f"⏱️  Request took {elapsed:.2f} seconds")
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        with open('booking_debug.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
        print(f"📁 Saved HTML ({len(response.text)} chars)")
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check page title
        title = soup.find('title')
        print(f"Title: {title.get_text()[:80] if title else 'N/A'}")
        
        # Look for prices
        all_text = soup.get_text()
        
        # Booking.com uses various price formats
        price_patterns = re.findall(r'TRY\s*[\d,]+|₺[\d.,]+|[\d.,]+\s*TL|\$[\d,]+|€[\d,]+', all_text)
        print(f"\n💰 Prices found: {len(set(price_patterns))}")
        for p in list(set(price_patterns))[:10]:
            print(f"  {p}")
        
        # Find hotel cards - Booking uses data-testid
        hotel_cards = soup.select('[data-testid="property-card"]')
        print(f"\n🏨 Property cards found: {len(hotel_cards)}")
        
        for card in hotel_cards[:5]:
            # Extract hotel name
            name_el = card.select_one('[data-testid="title"]') or card.find(['h3', 'a'])
            price_el = card.select_one('[data-testid="price-and-discounted-price"]') or card.find(text=re.compile(r'TRY|₺'))
            rating_el = card.select_one('[data-testid="review-score"]')
            
            name = name_el.get_text(strip=True) if name_el else "Unknown"
            price = price_el.get_text(strip=True) if price_el and hasattr(price_el, 'get_text') else str(price_el)[:50] if price_el else "N/A"
            rating = rating_el.get_text(strip=True) if rating_el else "N/A"
            
            print(f"\n  🏨 {name[:60]}")
            print(f"  💰 {price}")
            print(f"  ⭐ {rating}")
        
        # If no cards found, check alternative structures
        if not hotel_cards:
            print("\n=== ALTERNATIVE STRUCTURE SEARCH ===")
            
            # Look for any divs with hotel-like content
            result_divs = soup.find_all('div', {'data-testid': True})
            hotel_divs = [d for d in result_divs if 'property' in d.get('data-testid', '').lower() or 'hotel' in d.get('data-testid', '').lower()]
            print(f"Found {len(hotel_divs)} property/hotel divs")
            
            # Check for sr_property_block (older Booking.com structure)
            legacy_cards = soup.select('.sr_property_block, .sr-hotel__main, [class*="propertyCard"]')
            print(f"Found {len(legacy_cards)} legacy property blocks")
            
    else:
        print(f"❌ Failed! Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")

except Exception as e:
    print(f"💥 Error: {e}")
    import traceback
    traceback.print_exc()
