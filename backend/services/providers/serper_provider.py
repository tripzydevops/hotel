import os
import httpx
from typing import Dict, Any, Optional
from datetime import date
from ..data_provider_interface import HotelDataProvider

class SerperProvider(HotelDataProvider):
    """
    Serper.dev Provider for Google Search Results.
    Fast, JSON-based Scraper.
    """
    
    BASE_URL = "https://google.serper.dev/search"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("SERPER_API_KEY")

    def get_provider_name(self) -> str:
        return "Serper.dev"

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

        # Serper.dev accepts JSON payload
        query = f"hotels in {location} {hotel_name}"
        
        payload = {
            "q": query,
            "gl": "us",
            "hl": "en",
            "type": "places" # Optimize for places/hotels
        }
        
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.BASE_URL,
                    headers=headers,
                    json=payload,
                    timeout=15.0
                )
                
                if response.status_code != 200:
                    print(f"[Serper] Error {response.status_code}: {response.text}")
                    return None
                
                return self._parse_response(response.json(), hotel_name, currency)

        except Exception as e:
            print(f"[Serper] Exception: {e}")
            return None

    def _parse_response(self, data: Dict[str, Any], target_name: str, currency: str) -> Optional[Dict[str, Any]]:
        # Serper returns "places" or "organic"
        places = data.get("places", [])
        organic = data.get("organic", [])
        
        # Try to find best match in places first (richer data)
        best_match = None
        if places:
            best_match = places[0]
        elif organic:
            best_match = organic[0]
            
        if not best_match:
            return None

        # Price extraction (often in snippets or specialized fields)
        price_val = 0.0
        # Serper isn't specialized for Hotel JSON, so we might need to regex the "snippet" or "price" field if available
        # This is a basic implementation
        
        return {
            "price": price_val, # Placeholder - Serper often needs raw HTML parsing for exact dates/prices
            "currency": currency,
            "source": "Serper.dev",
            "url": best_match.get("link", ""),
            "rating": best_match.get("rating", 0.0),
            "reviews": best_match.get("reviews", 0),
            "amenities": [], # Serper basic usually doesn't have this
            "sentiment_breakdown": []
        }
