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

        # Use Google Places via Serper (Shopping returns irrelevant products like Toner)
        query = f"{hotel_name} {location}"
        
        payload = {
            "q": query,
            "gl": "tr",
            "hl": "en",
            "type": "places" 
        }
        
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://google.serper.dev/places",
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
        # Check 'places' list
        places = data.get("places", [])
        
        if not places:
            return None
            
        # Take first result (Places usually ranks best match first)
        best_match = places[0]
        
        # Places API does NOT return price. Return 0.0 with metadata.
        # This allows the system to at least 'find' the hotel.
        
        return {
            "price": 0.0,
            "currency": currency,
            "vendor": "Google Places", 
            "source": "Serper.dev",
            "url": best_match.get("website") or best_match.get("link", ""),
            "rating": best_match.get("rating", 0.0),
            "reviews": best_match.get("ratingCount", 0),
            "amenities": [], # Places doesn't return amenities easily in this list
            "sentiment_breakdown": []
        }
