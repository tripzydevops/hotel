"""
Trivago Hotel Scraper using Scrape.do with session cookies
Requires login cookies from authenticated browser session.
"""

import sys
import io
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
import time
import re
from typing import List, Dict, Optional
from dataclasses import dataclass

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# Your Scrape.do API Token
API_TOKEN = "1ea8a0c1790940088d5ee045f868f9f8647aa081c01"

# Trivago session cookies from logged-in browser
TRIVAGO_COOKIES = {
    "engagedVisit": "true",
    "trv_expm": "d0b94778-5153-47b5-9c44-bf16102fdddc",
    "edge_tid_s": "b9b54ff8e157320c56afe725e3",
    "edge_tid": "b9b54ff8e157320c56afe725e3",
    "ctid": "9f9f55133429a146a04784ddd0_t",
    "trv_wbs": "1352",
    "trv_wb": "1352",
    "userLanguage": "tr",
    "attrChannel": "sem",
    "crto_is_user_optout": "false",
}


@dataclass
class HotelResult:
    name: str
    price: str
    currency: str
    rating: Optional[str]
    review_count: Optional[str]
    source: str
    deal_source: Optional[str] = None  # Which OTA offers this price


def scrape_trivago_hotels(
    city: str,
    search_id: str,  # Trivago location ID (e.g., "412127" for Balikesir)
    checkin: str,
    checkout: str,
    cookies: Dict[str, str] = None,
) -> List[HotelResult]:
    """
    Scrape hotel listings from Trivago

    Args:
        city: City name for display
        search_id: Trivago location ID (ns:200, id:XXXXX)
        checkin: Check-in date YYYY-MM-DD
        checkout: Check-out date YYYY-MM-DD
        cookies: Session cookies from logged-in browser

    Returns:
        List of HotelResult objects
    """
    # Format dates for Trivago URL (YYYYMMDD)
    checkin_fmt = checkin.replace("-", "")
    checkout_fmt = checkout.replace("-", "")

    # Build Trivago URL
    target_url = (
        f"https://www.trivago.com/tr/srl"
        f"?languageCode=en_US"
        f"&search=200-{search_id}"
        f"&dr={checkin_fmt}-{checkout_fmt}"
        f"&drs=40"
    )

    # Build cookie string for Scrape.do
    cookie_str = "; ".join(
        [f"{k}={v}" for k, v in (cookies or TRIVAGO_COOKIES).items()]
    )

    # Build Scrape.do API URL - use setCookies parameter instead of customHeaders
    encoded_url = quote(target_url)
    encoded_cookies = quote(cookie_str)

    api_url = (
        f"https://api.scrape.do?token={API_TOKEN}"
        f"&url={encoded_url}"
        f"&render=true"
        f"&super=true"
        f"&wait=5000"
        f"&setCookies={encoded_cookies}"
    )

    print(f"🔍 Searching Trivago for {city}...")
    print(f"📅 {checkin} to {checkout}")
    print(f"🔗 URL: {target_url}")

    start_time = time.time()
    response = requests.get(api_url, timeout=120)
    elapsed = time.time() - start_time

    print(f"⏱️  Request took {elapsed:.2f}s (Status: {response.status_code})")

    if response.status_code != 200:
        print(f"❌ Failed: {response.text[:200]}")
        return []

    # Save for debugging
    with open("trivago_debug.html", "w", encoding="utf-8") as f:
        f.write(response.text)

    soup = BeautifulSoup(response.text, "html.parser")
    hotels: List[HotelResult] = []

    # Try to find hotel items - Trivago uses data-testid
    hotel_items = soup.select('li[data-testid="accommodation-list-element"]')

    if not hotel_items:
        # Try alternative selectors
        hotel_items = soup.select('[data-testid*="item"]')

    print(f"📊 Found {len(hotel_items)} hotels\n")

    for item in hotel_items:
        # Extract hotel name
        name_el = item.select_one('[data-testid="item-name"]') or item.find("button")
        name = name_el.get_text(strip=True) if name_el else "Unknown"

        # Extract price
        price_el = item.select_one('[data-testid="recommended-price"]')
        price_text = price_el.get_text(strip=True) if price_el else "N/A"

        # Parse price and currency (e.g., "₺3.738" or "€45")
        price_match = re.search(r"([₺€$]|TL|EUR|USD)\s*([\d.,]+)", price_text)
        if price_match:
            currency = price_match.group(1)
            price_value = price_match.group(2)
        else:
            currency = "TRY"
            price_value = re.sub(r"[^\d.,]", "", price_text) or price_text

        # Extract rating
        rating_el = item.select_one('[data-testid="rating-number"]')
        rating = rating_el.get_text(strip=True) if rating_el else None

        # Extract OTA source (e.g., "TatilBudur", "Trip.com")
        deal_el = item.select_one('[data-testid*="deal"]') or item.find(
            text=re.compile(r"\.com|Tatil|Trip|Otel")
        )
        deal_source = None
        if deal_el:
            deal_source = (
                deal_el.get_text(strip=True)
                if hasattr(deal_el, "get_text")
                else str(deal_el)
            )

        hotel = HotelResult(
            name=name,
            price=price_value,
            currency=currency,
            rating=rating,
            review_count=None,
            source="trivago",
            deal_source=deal_source,
        )
        hotels.append(hotel)

    return hotels


def main():
    # Check if cookies are configured
    if not TRIVAGO_COOKIES:
        print("⚠️  No cookies configured!")
        print("Please add your Trivago session cookies to TRIVAGO_COOKIES dict")
        print("\nTo get cookies:")
        print("1. Log into Trivago in your browser")
        print("2. Open DevTools (F12) > Application > Cookies")
        print("3. Copy the cookie values")
        return

    # Test: Search Balikesir hotels
    hotels = scrape_trivago_hotels(
        city="Balikesir",
        search_id="412127",  # Balikesir area ID from your browser
        checkin="2026-01-24",
        checkout="2026-01-25",
    )

    print("=" * 60)
    print("TRIVAGO RESULTS")
    print("=" * 60)

    for i, hotel in enumerate(hotels, 1):
        print(f"\n{i}. {hotel.name}")
        print(f"   💰 {hotel.currency} {hotel.price}")
        if hotel.rating:
            print(f"   ⭐ {hotel.rating}")
        if hotel.deal_source:
            print(f"   🏷️  Via: {hotel.deal_source}")


if __name__ == "__main__":
    main()
