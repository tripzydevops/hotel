import os
import httpx
import json
import base64
from typing import Dict, Any, Optional
from datetime import date
from ..data_provider_interface import HotelDataProvider

class DecodoProvider(HotelDataProvider):
    """
    DataForSEO Provider (Internal Label: Decodo)
    Uses DataForSEO Google Hotels API.
    """
    
    BASE_URL = "https://api.dataforseo.com/v3/serp/google/hotels/live/advanced"
    
    def __init__(self, api_key: Optional[str] = None):
        # We expect "login:password" in the DECODO_API_KEY env var
        self.auth_token = api_key or os.getenv("DECODO_API_KEY")
        if not self.auth_token:
            print("Warning: DECODO_API_KEY (DataForSEO Login:Pass) not found.")

    def get_provider_name(self) -> str:
        return "Decodo (DataForSEO)"

    async def fetch_price(
        self, 
        hotel_name: str, 
        location: str, 
        check_in: date, 
        check_out: date, 
        adults: int = 2, 
        currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        
        if not self.auth_token:
            return None

        # Prepare Auth (Basic Auth encoded)
        # If env is "login:pass", we encode it.
        # If it's already base64, we use it directly? Let's assume login:pass format for simplicity.
        try:
             # Basic Auth header generation
             basic_auth = base64.b64encode(self.auth_token.encode('utf-8')).decode('utf-8')
             headers = {
                 "Authorization": f"Basic {basic_auth}",
                 "Content-Type": "application/json"
             }
        except Exception:
            print("DataForSEO Auth Error: Check DECODO_API_KEY format (login:password)")
            return None

        # Construct Payload for DataForSEO
        # Their API expects a POST with task parameters
        payload = [
            {
                "location_name": location,
                "keyword": hotel_name,
                "check_in": check_in.strftime("%Y-%m-%d"),
                "check_out": check_out.strftime("%Y-%m-%d"),
                "adults": adults,
                "currency": currency,
                "language_code": "en",
                "sort_by": "relevance",
            }
        ]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.BASE_URL,
                    headers=headers,
                    json=payload,
                    timeout=45.0 # Serps take time
                )
                
                if response.status_code != 200:
                    print(f"DataForSEO Error {response.status_code}: {response.text}")
                    return None
                
                data = response.json()
                return self._parse_response(data)

        except Exception as e:
            print(f"DataForSEO Exception: {e}")
            return None

    def _parse_response(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalize DataForSEO JSON to our standard format.
        """
        try:
            tasks = data.get("tasks", [])
            if not tasks: 
                return None
                
            result_item = tasks[0].get("result", [])
            if not result_item:
                return None
                
            # 'items' contains the hotel suggestions/list
            items = result_item[0].get("items", [])
            if not items:
                return None
                
            # Find the best match (DataForSEO returns a list of hotels matching the query)
            # Usually the first one is the best match if we searched by Name + Location
            best_match = items[0]
            
            price_val = 0.0
            price_data = best_match.get("price", {})
            if price_data:
                price_val = float(price_data.get("value", 0))

            return {
                "price": price_val,
                "currency": price_data.get("currency", "USD"),
                "source": "DataForSEO",
                "url": best_match.get("hotel_info", {}).get("check_url", ""),
                "rating": best_match.get("hotel_rating", {}).get("value", 0.0),
                "reviews": best_match.get("hotel_rating", {}).get("votes_count", 0),
                "amenities": best_match.get("amenities", []),
                "sentiment_breakdown": [] # DataForSEO structure varies for this
            }
        except Exception as e:
            print(f"Error parsing DataForSEO response: {e}")
            return None
