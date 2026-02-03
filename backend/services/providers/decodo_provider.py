import os
import httpx
import json
from typing import Dict, Any, Optional
from datetime import date
from ..data_provider_interface import HotelDataProvider

class DecodoProvider(HotelDataProvider):
    """
    Decodo Provider for Google Hotels.
    Uses: https://scraper-api.decodo.com/v2/scrape
    Target: google_travel_hotels
    """
    
    BASE_URL = "https://scraper-api.decodo.com/v2/scrape"
    
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

        # Construct payload based on Decodo Scraper API patterns
        # Target: google_travel_hotels
        
        payload = {
            "target": "google_travel_hotels",
            "query": f"{hotel_name} {location}",
            "check_in": check_in.strftime("%Y-%m-%d"),
            "check_out": check_out.strftime("%Y-%m-%d"),
            "adults": adults,
            "currency": currency,
            "geo": "United States", # Decodo uses 'geo', not 'gl'
            "locale": "en-US"       # Decodo uses 'locale', not 'hl'
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.BASE_URL,
                    headers=headers,
                    json=payload,
                    timeout=60.0 # Scrapers can be slow
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
        Normalize Decodo JSON response.
        """
        # Note: Response structure depends on the specific Decodo parser for google_travel_hotels.
        # Typically returns 'body' or 'results' list.
        # We will attempt to handle common scraper response shapes.
        
        results = data.get("results", []) or data.get("body", [])
        
        if not results:
            return None
            
        # Optimization: Find best match
        best_match = results[0] if isinstance(results, list) else results
        
        try:
            price_val = 0.0
            price_raw = best_match.get("price") or best_match.get("cheap_price") or 0
            
            if isinstance(price_raw, str):
                # Clean "$120" -> 120.0
                price_val = float(''.join(filter(lambda x: x.isdigit() or x == '.', price_raw)))
            else:
                price_val = float(price_raw)

            return {
                "price": price_val,
                "currency": best_match.get("currency", "USD"),
                "source": "Decodo",
                "url": best_match.get("link", ""),
                "rating": float(best_match.get("rating", 0.0)),
                "reviews": int(best_match.get("reviews", 0)),
                "amenities": best_match.get("amenities", []),
                "sentiment_breakdown": [] 
            }
        except Exception as e:
            print(f"Error parsing Decodo response: {e}")
            return None
