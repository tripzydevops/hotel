"""
SerpApi Client for Hotel Price Fetching
Fetches real-time hotel prices from Google Hotels via SerpApi.
"""

import os
import httpx
from typing import Optional, List, Dict, Any
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

SERPAPI_BASE_URL = "https://serpapi.com/search"
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")


class SerpApiClient:
    """Client for fetching hotel prices from SerpApi."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or SERPAPI_API_KEY
        if not self.api_key:
            raise ValueError("SerpApi API key is required. Set SERPAPI_API_KEY env var.")
    
    def _normalize_string(self, text: Optional[str]) -> str:
        """Normalize string to Title Case and strip whitespace."""
        if not text:
            return ""
        return " ".join(word.capitalize() for word in text.split())

    def _clean_hotel_name(self, name: str) -> str:
        """
        Clean hotel name by removing promotional noise often found in SerpApi results.
        e.g. "Ramada by Wyndham - Best Price Guaranteed" -> "Ramada By Wyndham"
        """
        if not name:
            return ""
            
        cleaned = name.split(" - ")[0] # Split by dash
        cleaned = cleaned.split(" | ")[0] # Split by pipe
        cleaned = cleaned.split(" (")[0] # Remove parentheticals
        
        # Remove common marketing phrases
        phrases_to_remove = [
            "Best Price Guaranteed",
            "Special Offer",
            "Official Site",
            "Low Price",
            "Book Now",
            "Free Cancellation"
        ]
        
        for phrase in phrases_to_remove:
            # Case insensitive replacement
            import re
            cleaned = re.sub(re.escape(phrase), "", cleaned, flags=re.IGNORECASE).strip()
            
        return self._normalize_string(cleaned)
    
    async def fetch_hotel_price(
        self,
        hotel_name: str,
        location: str,
        check_in: Optional[date] = None,
        check_out: Optional[date] = None,
        currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch price for a specific hotel.
        
        Args:
            hotel_name: Name of the hotel to search
            location: City/region for the search
            check_in: Check-in date (defaults to tonight)
            check_out: Check-out date (defaults to tomorrow)
        
        Returns:
            Dict with price info or None if not found
        """
        # Default to tonight/tomorrow if not specified
        if not check_in:
            check_in = date.today()
        if not check_out:
            check_out = check_in + timedelta(days=1)
        
        # Normalize inputs for consistency
        hotel_name = self._normalize_string(hotel_name)
        location = self._normalize_string(location)
        
        params = {
            "engine": "google_hotels",
            "q": f"{hotel_name} {location}",
            "check_in_date": check_in.isoformat(),
            "check_out_date": check_out.isoformat(),
            "adults": 2,
            "currency": currency,
            "gl": "us",
            "hl": "en",
            "api_key": self.api_key,
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(SERPAPI_BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
                
                return self._parse_hotel_result(data, hotel_name, currency)
                
        except httpx.HTTPError as e:
            print(f"[SerpApi] HTTP error fetching {hotel_name}: {e}")
            return None
        except Exception as e:
            print(f"[SerpApi] Error fetching {hotel_name}: {e}")
            return None
    
    def _parse_hotel_result(
        self, 
        data: Dict[str, Any], 
        target_hotel: str,
        default_currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        """Parse SerpApi response to extract hotel price."""
        
        # Check for properties in response
        properties = data.get("properties", [])
        
        if not properties:
            # Try alternative response structure
            properties = data.get("organic_results", [])
        
        if not properties:
            print(f"[SerpApi] No properties found for {target_hotel}")
            return None
        
        # Find the best matching hotel
        target_lower = target_hotel.lower()
        best_match = None
        best_score = 0
        
        for prop in properties:
            name = prop.get("name", "").lower()
            # Simple matching score
            score = sum(1 for word in target_lower.split() if word in name)
            
            if score > best_score:
                best_score = score
                best_match = prop
        
        if not best_match:
            # Fall back to first result
            best_match = properties[0]
        
        # Extract price and currency
        price = None
        currency = default_currency
        
        # Try different price fields
        if "rate_per_night" in best_match:
            rate = best_match["rate_per_night"]
            if isinstance(rate, dict):
                price = rate.get("lowest", rate.get("extracted_lowest"))
            else:
                price = rate
        elif "price" in best_match:
            price = best_match["price"]
        elif "prices" in best_match and best_match["prices"]:
            price = best_match["prices"][0].get("rate_per_night", {}).get("lowest")
        
        # Clean up price if it's a string
        if isinstance(price, str):
            price = float(price.replace("$", "").replace(",", "").strip())
        
        if price is None:
            print(f"[SerpApi] Could not extract price for {target_hotel}")
            return None
        
        return {
            "hotel_name": self._clean_hotel_name(best_match.get("name", target_hotel)),
            "price": float(price),
            "currency": currency,
            "source": "serpapi",
            "vendor": best_match.get("deal_description", "Unknown Vendor"), # e.g. "Booking.com"
            "rating": best_match.get("overall_rating"), # e.g. 4.5
            "stars": best_match.get("extracted_hotel_class"), # e.g. 5
            "property_token": best_match.get("property_token"), # Unique ID
            "image_url": best_match.get("images", [{}])[0].get("thumbnail"), # First image
            "raw_data": best_match,
        }
    
    async def fetch_multiple_hotels(
        self,
        hotels: List[Dict[str, str]],
        check_in: Optional[date] = None,
        check_out: Optional[date] = None,
        currency: str = "USD"
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Fetch prices for multiple hotels.
        
        Args:
            hotels: List of dicts with 'name' and 'location' keys
            check_in: Check-in date
            check_out: Check-out date
        
        Returns:
            Dict mapping hotel names to their price data
        """
        results = {}
        
        for hotel in hotels:
            name = hotel.get("name", "")
            location = hotel.get("location", "")
            
            if not name:
                continue
            
            result = await self.fetch_hotel_price(
                hotel_name=name,
                location=location,
                check_in=check_in,
                check_out=check_out,
                currency=currency
            )
            
            results[name] = result
        
        return results


# Singleton instance
serpapi_client = SerpApiClient()
