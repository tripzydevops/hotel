import os
import httpx
import json
from typing import Dict, Any, Optional
from datetime import date
from ..data_provider_interface import HotelDataProvider

class DecodoProvider(HotelDataProvider):
    """
    Decodo (Web Scraping API) Provider for Google Hotels.
    Uses the dedicated Google Hotels scraper functionality.
    """
    
    BASE_URL = "https://api.decodo.com/v1/scraper" # Hypothetical endpoint based on research
    # NOTE: Since Decodo is a scraper, we often send the payload to a generic endpoint 
    # with "target": "google_hotels" or similar. 
    # Based on typical scraper API patterns (like ScraperAPI/Smartproxy):
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("DECODO_API_KEY")
        if not self.api_key:
            print("Warning: DECODO_API_KEY not found.")

    def get_provider_name(self) -> str:
        return "Decodo"

    async def fetch_price(
        self, 
        hotel_name: str, 
        location: str, 
        check_in: date, 
        check_out: date, 
        adults: int = 2, 
        currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        
        if not self.api_key:
            return None

        # Construction of the query
        query = f"{hotel_name} {location}"
        
        # Payload structure for a generic Scraping API usually involves:
        # 1. Target URL (Google Hotels Search URL)
        # 2. OR Specific "google_hotels" platform parameter
        
        # Let's assume a structure similar to what was researched (Generic format)
        # We will target the Google Hotels search page directly via the scraper
        
        # Construct Google Hotels URL (Reliable method for scrapers)
        check_in_str = check_in.strftime("%Y-%m-%d")
        check_out_str = check_out.strftime("%Y-%m-%d")
        
        # Using a specialized query params structure for Decodo/Scraper APIs
        payload = {
            "api_key": self.api_key,
            "url": "https://www.google.com/travel/hotels", 
            "query": query, # Most advanced scraper APIs accept a raw query for specific platforms
            "platform": "google_hotels", # Explicit platform trigger
            "params": {
                "check_in": check_in_str,
                "check_out": check_out_str,
                "adults": adults,
                "currency": currency,
                "gl": "us", # Localization
                "hl": "en"
            },
            "render": True # Ensure dynamic content is loaded
        }

        try:
            async with httpx.AsyncClient() as client:
                # Note: This is an example POST. Real implementation might differ slightly based on specific Decodo docs version.
                # using a generic scraper endpoint pattern:
                response = await client.post(
                    "https://api.decodo.com/v1/search", # Assumed Endpoint from research
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    print(f"Decodo Error {response.status_code}: {response.text}")
                    return None
                
                data = response.json()
                return self._parse_response(data)

        except Exception as e:
            print(f"Decodo Exception: {e}")
            return None

    def _parse_response(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalize Decodo JSON to our standard format.
        """
        # Look for the "organic" or "hotels" list in the response
        results = data.get("organic_results", []) or data.get("hotels", [])
        
        if not results:
            return None
            
        # Optimization: Find best match
        # For now, take the first result
        best_match = results[0]
        
        try:
            price_val = 0.0
            price_raw = best_match.get("price", "0")
            if isinstance(price_raw, str):
                # Clean "$120" -> 120.0
                price_val = float(''.join(filter(str.isdigit, price_raw)))
            else:
                price_val = float(price_raw)

            return {
                "price": price_val,
                "currency": best_match.get("currency", "USD"), # Decodo usually returns this
                "source": "Decodo",
                "url": best_match.get("link", ""),
                "rating": best_match.get("rating", 0.0),
                "reviews": best_match.get("reviews", 0),
                "amenities": best_match.get("amenities", []),
                # If they provide sentiment/snippets
                "sentiment_breakdown": best_match.get("reviews_breakdown", []) 
            }
        except Exception as e:
            print(f"Error parsing Decodo response: {e}")
            return None
