"""
Hotel Price Comparison Tool
Compares prices across multiple sources (Booking.com, Trivago, etc.)
"""

import sys
import io

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from dataclasses import dataclass, field
from typing import List, Dict, Optional
import re

# Import scrapers
from booking_scraper import scrape_booking_hotels


@dataclass
class HotelComparison:
    """Combined hotel data from multiple sources"""

    name: str
    normalized_name: str  # For matching across sources
    prices: Dict[str, Dict] = field(default_factory=dict)  # source -> {price, currency}
    ratings: Dict[str, str] = field(default_factory=dict)  # source -> rating

    @property
    def best_price(self) -> Optional[Dict]:
        """Get the lowest price across all sources"""
        if not self.prices:
            return None
        return min(
            self.prices.values(),
            key=lambda x: float(x["price"].replace(",", "").replace(".", "")),
        )

    @property
    def price_spread(self) -> Optional[float]:
        """Calculate price difference between highest and lowest"""
        if len(self.prices) < 2:
            return None
        prices = [
            float(p["price"].replace(",", "").replace(".", ""))
            for p in self.prices.values()
        ]
        return max(prices) - min(prices)


def normalize_hotel_name(name: str) -> str:
    """Normalize hotel name for matching across sources"""
    # Remove common words and special characters
    name = name.lower()
    name = re.sub(r"[^\w\s]", "", name)
    # Remove common hotel-related words
    for word in ["hotel", "otel", "inn", "spa", "residence", "suites", "resort"]:
        name = name.replace(word, "")
    # Remove extra whitespace
    name = " ".join(name.split())
    return name.strip()


def compare_hotel_prices(
    city: str, checkin: str, checkout: str, adults: int = 2
) -> List[HotelComparison]:
    """
    Compare hotel prices from multiple sources

    Args:
        city: City name to search
        checkin: Check-in date YYYY-MM-DD
        checkout: Check-out date YYYY-MM-DD
        adults: Number of adults

    Returns:
        List of HotelComparison objects with prices from all sources
    """
    comparisons: Dict[str, HotelComparison] = {}

    # 1. Fetch from Booking.com
    print("=" * 60)
    print("FETCHING PRICES FROM BOOKING.COM")
    print("=" * 60)

    booking_hotels = scrape_booking_hotels(
        city=f"{city}, Turkey",
        checkin=checkin,
        checkout=checkout,
        adults=adults,
        currency="TRY",
    )

    for hotel in booking_hotels:
        norm_name = normalize_hotel_name(hotel.name)

        if norm_name not in comparisons:
            comparisons[norm_name] = HotelComparison(
                name=hotel.name, normalized_name=norm_name
            )

        comparisons[norm_name].prices["booking.com"] = {
            "price": hotel.price,
            "currency": hotel.currency,
        }
        if hotel.rating:
            comparisons[norm_name].ratings["booking.com"] = hotel.rating

    # 2. TODO: Add Trivago when auth is working
    # print("\n" + "=" * 60)
    # print("FETCHING PRICES FROM TRIVAGO")
    # print("=" * 60)
    # trivago_hotels = scrape_trivago_hotels(...)

    return list(comparisons.values())


def print_comparison_report(comparisons: List[HotelComparison]):
    """Print a formatted comparison report"""
    print("\n" + "=" * 70)
    print("🏨 HOTEL PRICE COMPARISON REPORT")
    print("=" * 70)

    # Sort by best price
    sorted_hotels = sorted(
        comparisons,
        key=lambda h: (
            float(h.best_price["price"].replace(",", "").replace(".", ""))
            if h.best_price
            else float("inf")
        ),
    )

    for i, hotel in enumerate(sorted_hotels, 1):
        print(f"\n{i}. {hotel.name}")
        print("-" * 50)

        for source, price_info in hotel.prices.items():
            rating = hotel.ratings.get(source, "N/A")
            price_display = f"{price_info['currency']} {price_info['price']}"
            print(f"   📍 {source.upper():15} | 💰 {price_display:12} | ⭐ {rating}")

        if hotel.price_spread:
            print(f"   💡 Price spread: {hotel.price_spread:,.0f} TL")


def main():
    print("🔍 Starting Hotel Price Comparison")
    print("📍 Location: Balikesir, Turkey")
    print("📅 Dates: 2026-01-24 to 2026-01-25")
    print()

    comparisons = compare_hotel_prices(
        city="Balikesir", checkin="2026-01-24", checkout="2026-01-25", adults=2
    )

    print_comparison_report(comparisons)

    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    print(f"   Total hotels found: {len(comparisons)}")
    print("   Data sources used: Booking.com")
    print("   Note: Trivago requires complex authentication (pending)")


if __name__ == "__main__":
    main()
