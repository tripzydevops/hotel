import os
import httpx
from typing import Dict, Any, Optional
from datetime import date
from ..data_provider_interface import HotelDataProvider

class RapidApiProvider(HotelDataProvider):
    """
    RapidAPI Provider for Booking.com (via Betify/Tipsters).
    Limit: 500 requests/month (Free Tier).
    """
    
    # Base URL for the "Booking.com" API by Betify on RapidAPI
    BASE_URL = "https://booking-com.p.rapidapi.com/v1/hotels/search"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("RAPIDAPI_KEY")
        self.host = "booking-com.p.rapidapi.com"

    def get_provider_name(self) -> str:
        return "RapidApi"

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

        # 1. We typically need a "dest_id" (Destination ID) for Booking.com APIs.
        # This provider usually has a "locations/auto-complete" endpoint.
        # For MVP, we might skip if we can't find dest_id easily, OR we try to implement the 2-step flow.
        # Let's try the 2-step flow: Location Search -> Hotel Search.
        
        async with httpx.AsyncClient() as client:
            headers = {
                "X-RapidAPI-Key": self.api_key,
                "X-RapidAPI-Host": self.host
            }

            try:
                # Step A: Get Destination ID
                # Endpoint varies, usually /v1/hotels/locations
                dest_id = await self._get_destination_id(client, location, headers)
                if not dest_id:
                    print(f"[RapidApi] Could not find destination: {location}")
                    return None

                # Step B: Search Hotels
                params = {
                    "checkin_date": check_in.isoformat(),
                    "checkout_date": check_out.isoformat(),
                    "dest_id": dest_id,
                    "dest_type": "city", # Assuming city for now
                    "adults_number": adults,
                    "order_by": "popularity",
                    "filter_by_currency": currency,
                    "locale": "en-gb",
                    "units": "metric"
                }
                
                response = await client.get(self.BASE_URL, headers=headers, params=params, timeout=30.0)
                
                if response.status_code != 200:
                    print(f"[RapidApi] Error {response.status_code}: {response.text}")
                    return None
                    
                data = response.json()
                return self._parse_response(data, hotel_name, currency)

            except Exception as e:
                print(f"[RapidApi] Exception: {e}")
                return None

    async def _get_destination_id(self, client, location: str, headers: Dict) -> Optional[str]:
        """Helper to get Booking.com Destination ID."""
        try:
            url = "https://booking-com.p.rapidapi.com/v1/hotels/locations"
            params = {"name": location, "locale": "en-gb"}
            res = await client.get(url, headers=headers, params=params)
            if res.status_code == 200:
                data = res.json()
                # Iterate to find a 'city' type
                for item in data:
                    if item.get("dest_type") == "city":
                        return item.get("dest_id")
                # Fallback to first item
                if data: return data[0].get("dest_id")
        except:
            pass
        return None

    def _parse_response(self, data: Dict[str, Any], target_name: str, currency: str) -> Optional[Dict[str, Any]]:
        # This API usually returns a 'result' list
        results = data.get("result", [])
        if not results: return None
        
        # Simple fuzzy match for hotel name
        best_match = None
        target_clean = target_name.lower()
        
        for hotel in results:
            name = hotel.get("hotel_name", "").lower()
            if target_clean in name or name in target_clean:
                best_match = hotel
                break
        
        if not best_match and results:
            best_match = results[0] # Fallback
            
        if not best_match: return None

        # Extract Price (Booking.com extraction can be tricky, check 'composite_price_breakdown')
        price_val = 0.0
        try:
            # Look for gross_amount
            gross = best_match.get("composite_price_breakdown", {}).get("gross_amount", {})
            price_val = float(gross.get("value", 0))
        except:
            pass

        return {
            "price": price_val,
            "currency": currency,
            "source": "RapidApi (Booking)",
            "url": best_match.get("url", ""),
            "rating": best_match.get("review_score", 0.0),
            "reviews": best_match.get("review_nr", 0),
            "amenities": [], # Requires extra call usually
            "sentiment_breakdown": []
        }
