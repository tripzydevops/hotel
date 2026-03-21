import os
import asyncio
import httpx
from datetime import date, datetime
from typing import Dict, Any, Optional
from backend.services.data_provider_interface import HotelDataProvider
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class DataForSEOProvider(HotelDataProvider):
    """
    DataForSEO Google Hotels API Provider.
    Uses HTTP Basic Authentication.
    """

    def __init__(self):
        self.login = os.getenv("DATAFORSEO_LOGIN")
        self.password = os.getenv("DATAFORSEO_PASSWORD")
        self.api_url = "https://api.dataforseo.com/v3"
        
        if not self.login or not self.password:
            logger.warning("DataForSEO credentials missing from environment.")

    def get_provider_name(self) -> str:
        return "DataForSEO"

    async def fetch_price(
        self,
        hotel_name: str,
        location: str,
        check_in: date,
        check_out: date,
        adults: int = 2,
        currency: str = "USD",
        serp_api_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Implementation of HotelDataProvider.fetch_price using DataForSEO.
        This uses the 'serp/google/hotels/task_post' and 'task_get' flow.
        """
        if not self.login or not self.password:
            return {"status": "error", "error": "missing_credentials"}

        auth = (self.login, self.password)
        
        try:
            # 1. Create Task (POST)
            # KAİZEN: Standard Search Strategy
            # We use the generic search to find the hotel and its price.
            post_data = [{
                "location_name": location,
                "keyword": hotel_name,
                "check_in": check_in.strftime("%Y-%m-%d"),
                "check_out": check_out.strftime("%Y-%m-%d"),
                "currency": currency,
                "adults": adults,
                "device": "desktop",
                "os": "windows",
                "language_name": "English"
            }]

            async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=post_data
                )
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    logger.error(f"DataForSEO Task Creation Failed: {res_json.get('status_message')}")
                    return {"status": "error", "error": res_json.get("status_message")}

                task_id = res_json["tasks"][0]["id"]
                logger.info(f"DataForSEO Task Created (Standard Queue): {task_id} for {hotel_name}. Turnaround can be up to 45m.")

                # 2. Polling for Results
                # KAİZEN: Standard Queue Resilience
                # Standard queue can take minutes. We'll poll for a while, but for
                # a background worker, it's best to check and move on.
                max_attempts = 60  # Increased to 5+ minutes for sync wait
                delay = 10.0      # Poll every 10 seconds
                
                for attempt in range(max_attempts):
                    await asyncio.sleep(delay)
                    
                    get_res = await client.get(
                        f"{self.api_url}/business_data/google/hotel_searches/task_get/sorted/{task_id}"
                    )
                    get_json = get_res.json()
                    
                    if get_json.get("status_code") == 20000:
                        # Task Finished
                        task_data = get_json["tasks"][0]
                        if not task_data.get("result"):
                            return {"status": "empty", "message": "No results found"}
                        
                        # Find the target hotel in the results
                        # Since we used the hotel name as keyword, it should be top result
                        items = task_data["result"][0].get("items", [])
                        if not items:
                            return {"status": "empty", "message": "No items in result"}
                        
                        # Match by name or ID if possible
                        target = items[0] # Simplest: take the top match
                        
                        # KAİZEN: Extract property token (hotel_identifier)
                        property_token = target.get("hotel_identifier")
                        
                        return {
                            "price": target.get("price", 0.0),
                            "currency": currency,
                            "source": "DataForSEO",
                            "vendor": target.get("vendor", "Direct"),
                            "url": f"https://www.google.com/search?q={hotel_name}", # Fallback
                            "rating": target.get("rating", {}).get("value", 0.0),
                            "reviews": target.get("rating", {}).get("votes_count", 0),
                            "property_token": property_token,
                            "status": "success",
                            "task_id": task_id
                        }
                    
                    elif get_json.get("status_code") == 40400:
                        # Task still processing
                        logger.info(f"DataForSEO Task {task_id} still processing (Attempt {attempt+1})")
                        continue
                    else:
                        logger.error(f"DataForSEO Task Get Error: {get_json.get('status_message')}")
                        return {"status": "error", "error": get_json.get("status_message")}

                return {"status": "timeout", "error": "DataForSEO task timed out"}

        except Exception as e:
            logger.error(f"DataForSEO Provider Error: {e}")
            return {"status": "error", "error": str(e)}

    async def fetch_hotel_info(self, hotel_identifier: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves detailed hotel information (amenities, images, sentiment) 
        using the DataForSEO Google Hotels Info Live API.
        """
        if not self.login or not self.password or not hotel_identifier:
            return None

        auth = (self.login, self.password)
        post_data = [{"hotel_identifier": hotel_identifier, "language_name": "English"}]

        try:
            async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
                # Use LIVE endpoint for immediate response
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/live/advanced",
                    json=post_data
                )
                res_json = response.json()

                if res_json.get("status_code") == 20000 and res_json.get("tasks"):
                    task = res_json["tasks"][0]
                    if task.get("result"):
                        result = task["result"][0]
                        
                        # Map DataForSEO fields to internal schema
                        contact = result.get("contact_info", {})
                        location = result.get("location_info", {})
                        
                        return {
                            "rating": result.get("rating", {}).get("value"),
                            "review_count": result.get("rating", {}).get("votes_count"),
                            "stars": result.get("stars"),
                            "amenities": result.get("amenities"),
                            "images": result.get("images"),
                            "image_url": result.get("images", [None])[0] if result.get("images") else None,
                            "location": location.get("address"),
                            "address": location.get("address"),
                            "latitude": location.get("latitude"),
                            "longitude": location.get("longitude"),
                            "reviews_breakdown": result.get("reviews_breakdown"),
                            "description": result.get("description"),
                            "phone": contact.get("phone"),
                            "email": contact.get("email"),
                            "website": contact.get("url") or contact.get("website"),
                            "cid": result.get("cid"),
                            "place_id": result.get("place_id"),
                        }
                
                logger.warning(f"DataForSEO Hotel Info failed: {res_json.get('status_message')}")
                return None

        except Exception as e:
            logger.error(f"DataForSEO fetch_hotel_info error: {e}")
            return None
    async def get_hotel_metadata(self, name: str, location: str) -> Optional[Dict[str, Any]]:
        """
        High-level helper to get full hotel metadata by name and location.
        Performs a search first to get the identifier, then fetches full info.
        """
        try:
            from datetime import date
            # 1. Search to get property_token (identifier)
            # We reuse fetch_price but we don't care about the price as much as the token
            search_data = await self.fetch_price(
                hotel_name=name,
                location=location,
                # We use today's date for a dummy search to find the hotel
                check_in=date.today(),
                check_out=date.today(),
            )
            
            # Map search_data to property_token
            # We check if search_data is a dict or a result
            token = search_data.get("property_token") if isinstance(search_data, dict) else None
            
            if not token:
                logger.info(f"Metadata Discovery: No property token found for {name} via price search.")
                return None
                
            # 2. Get full info from the token
            return await self.fetch_hotel_info(token)
            
        except Exception as e:
            logger.error(f"get_hotel_metadata error: {e}")
            return None

# Singleton instance for system-wide use
dataforseo_provider = DataForSEOProvider()
