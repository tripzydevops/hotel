import httpx
from typing import Optional, Dict, Any, Tuple
from datetime import date
from backend.services.data_provider_interface import HotelDataProvider

class RapidApiProvider(HotelDataProvider):
    """
    Provider for fetching hotel data via RapidAPI (Booking.com).
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.host = "booking-com15.p.rapidapi.com"
        self.headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.host,
            "Content-Type": "application/json"
        }
        self.base_url = f"https://{self.host}/api/v1/hotels"

    def get_provider_name(self) -> str:
        return "RapidAPI"

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

        try:
            async with httpx.AsyncClient() as client:
                # 1. Resolve Hotel ID
                dest_id, search_type = await self._resolve_destination(client, hotel_name, location)
                
                if not dest_id:
                    print(f"[RapidAPI] Could not resolve destination for: {hotel_name}")
                    return None

                # 2. Fetch Prices
                return await self._get_hotel_details(
                    client, 
                    dest_id, 
                    search_type, 
                    hotel_name, 
                    check_in, 
                    check_out, 
                    adults, 
                    currency
                )

        except Exception as e:
            print(f"[RapidAPI] Exception: {e}")
            return None

    async def _resolve_destination(self, client: httpx.AsyncClient, hotel_name: str, location: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Search for the hotel to get its proprietary Booking.com 'dest_id'.
        """
        url = f"{self.base_url}/searchDestination"
        
        # Clean query: Avoid "Hotel City City"
        clean_name = hotel_name
        if location.lower() in hotel_name.lower():
            query = hotel_name
        else:
            query = f"{hotel_name} {location}"
            
        async def perform_search(search_query: str):
            try:
                resp = await client.get(url, headers=self.headers, params={"query": search_query})
                if resp.status_code != 200:
                    return None, None
                
                data = resp.json()
                locations = []
                if isinstance(data, list): locations = data
                elif isinstance(data, dict):
                     if "data" in data: locations = data["data"]
                     elif "result" in data: locations = data["result"]
                
                for item in locations:
                    if item.get("dest_type") == "hotel":
                        return item.get("dest_id"), "hotel"
                return None, None
            except Exception as e:
                print(f"[RapidAPI] Destination search exception for '{search_query}': {e}")
                return None, None

        # Try Primary Search
        dest_id, search_type = await perform_search(query)
        
        # Try Fallback: Just Hotel Name (Booking.com usually knows where it is)
        if not dest_id and query != hotel_name:
            print(f"[RapidAPI] Fallback searching for just hotel name: {hotel_name}")
            dest_id, search_type = await perform_search(hotel_name)
            
        return dest_id, search_type

    async def _get_hotel_details(
        self, 
        client: httpx.AsyncClient, 
        dest_id: str, 
        search_type: str, 
        target_name: str,
        check_in: date, 
        check_out: date, 
        adults: int, 
        currency: str
    ) -> Optional[Dict[str, Any]]:
        
        url = f"{self.base_url}/searchHotels"
        params = {
            "dest_id": dest_id,
            "search_type": search_type,
            "arrival_date": check_in.strftime("%Y-%m-%d"),
            "departure_date": check_out.strftime("%Y-%m-%d"),
            "adults": str(adults),
            "units": "metric",
            "temperature_unit": "c",
            "languagecode": "en-us",
            "currency_code": currency
        }
        
        try:
            resp = await client.get(url, headers=self.headers, params=params)
            if resp.status_code != 200:
                print(f"[RapidAPI] Search Error {resp.status_code}: {resp.text}")
                return None
            
            data = resp.json()
            
            # Extract hotels list
            hotels = []
            if "data" in data and "hotels" in data["data"]:
                hotels = data["data"]["hotels"]
            elif "result" in data:
                hotels = data["result"]
            
            if not hotels:
                return None
                
            best_match = hotels[0]
            prop = best_match.get("property", best_match)
            
            price_val = 0.0
            if "priceBreakdown" in prop:
                 price_val = prop["priceBreakdown"].get("grossPrice", {}).get("value", 0.0)
            
            # 2026 Resilience: If price is too low, check if it's per person 
            # (Hilton Garden Inn for ₺1800 usually means per person when it should be ₺3600)
            if price_val > 0 and price_val < 3000 and adults > 1 and currency == "TRY":
                 print(f"[RapidAPI] Price {price_val} looks like per-person. Scaling by {adults} adults.")
                 price_val = price_val * adults
            
            if price_val == 0:
                 print(f"[RapidAPI] Found hotel {target_name} but price is 0. Skipping.")
                 return None
            
            # Extra Fields (Photos, Checkin, etc)
            photos = prop.get("photoUrls", [])
            checkin = prop.get("checkin", {})
            checkout = prop.get("checkout", {})
            review_word = prop.get("reviewScoreWord", "")
            
            return {
                "price": float(price_val),
                "currency": currency,
                "vendor": "Booking.com",
                "source": "RapidAPI",
                "resolved_name": prop.get("name", target_name),
                "url": "", 
                "rating": prop.get("reviewScore", 0.0),
                "reviews": prop.get("reviewCount", 0),
                "amenities": [], 
                "sentiment_breakdown": [], 
                # Extended Metadata
                "photos": photos[:5] if photos else [],
                "checkin_time": checkin.get("fromTime"),
                "checkout_time": checkout.get("untilTime"),
                "review_word": review_word,
                "is_preferred": prop.get("isPreferred", False)
            }

        except Exception as e:
            print(f"[RapidAPI] Details Exception: {e}")
            return None
