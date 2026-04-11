import os
import asyncio
import httpx
import json
from datetime import date, datetime
from typing import Dict, Any, Optional, List
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
        currency: str = "TRY",  # Default to TRY as requested
        serp_api_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Implementation of HotelDataProvider.fetch_price using DataForSEO Live Search.
        Captures best price and all market offers (OTA prices).
        """
        if not self.login or not self.password:
            return {"status": "error", "error": "missing_credentials"}

        auth = (self.login, self.password)
        
        try:
            # Using LIVE endpoint for immediate response
            post_data = [{
                "location_name": location,
                "keyword": hotel_name,
                "check_in": check_in.strftime("%Y-%m-%d"),
                "check_out": check_out.strftime("%Y-%m-%d"),
                "currency": currency,
                "adults": adults,
                "limit": 1
            }]

            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/live",
                    json=post_data
                )
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    logger.error(f"DataForSEO Live Search Failed: {res_json.get('status_message')}")
                    return {"status": "error", "error": res_json.get("status_message")}

                task = res_json.get("tasks", [{}])[0]
                if not task.get("result"):
                    return {"status": "empty", "message": "No results found"}
                
                items = task["result"][0].get("items", [])
                print(f"DEBUG: Task result items count: {len(items)}")
                if not items:
                    print(f"DEBUG: Full task result: {json.dumps(task['result'][0], indent=2)}")
                    return {"status": "empty", "message": "No items in search result"}
                
                target = items[0]
                # DataForSEO identifier for detailed info fetch later
                property_token = target.get("hotel_identifier")
                
                # Capture OTA prices (Market Offers)
                # Some versions of the API return 'vendors', others 'market_offers'
                market_offers = target.get("vendors") or target.get("market_offers") or []
                
                return {
                    "price": target.get("price", 0.0),
                    "currency": currency,
                    "source": "DataForSEO",
                    "vendor": target.get("vendor", "Direct"),
                    "url": f"https://www.google.com/search?q={hotel_name}",
                    "rating": target.get("rating", {}).get("value", 0.0),
                    "reviews": target.get("rating", {}).get("votes_count", 0),
                    "property_token": property_token,
                    "market_offers": market_offers,
                    "status": "success"
                }

        except Exception as e:
            logger.error(f"DataForSEO Provider fetch_price Error: {e}")
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
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
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
            from datetime import date, timedelta
            # 1. Search to get property_token (identifier)
            search_data = await self.fetch_price(
                hotel_name=name,
                location=location,
                # Use today's date for a dummy search to find the hotel
                check_in=date.today(),
                check_out=date.today() + timedelta(days=1),
            )
            
            token = search_data.get("property_token") if isinstance(search_data, dict) else None
            
            if not token:
                logger.info(f"Metadata Discovery: No property token found for {name} via price search.")
                return None
                
            # 2. Get full info from the token
            return await self.fetch_hotel_info(token)
            
        except Exception as e:
            logger.error(f"get_hotel_metadata error: {e}")
            return None

    # ===== Task API (Async) Implementation =====

    async def post_price_tasks(self, task_params: List[Dict[str, Any]]) -> Optional[List[str]]:
        """
        Submits multiple hotel search tasks to DataForSEO.
        Returns a list of Task IDs.
        """
        if not self.login or not self.password or not task_params:
            return None

        auth = (self.login, self.password)
        
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=task_params
                )
                res_json = response.json()
                
                if res_json.get("status_code") == 20000:
                    return [task.get("id") for task in res_json.get("tasks", []) if task.get("id")]
                
                logger.error(f"DataForSEO Task POST Failed: {res_json.get('status_message')}")
                return None
        except Exception as e:
            logger.error(f"DataForSEO post_price_tasks error: {e}")
            return None

    async def fetch_task_results(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves results for a specific completed task.
        """
        if not self.login or not self.password or not task_id:
            return None

        auth = (self.login, self.password)
        
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.get(
                    f"{self.api_url}/business_data/google/hotel_searches/task_get/advanced/{task_id}"
                )
                res_json = response.json()
                
                status_code = res_json.get("status_code")
                if status_code != 20000:
                    logger.warning(f"DataForSEO Task GET failed for {task_id}: {res_json.get('status_message')} (Code: {status_code})")
                    return None

                tasks = res_json.get("tasks", [])
                if not tasks:
                    logger.warning(f"DataForSEO Task GET returned no tasks for {task_id}")
                    return None
                
                task = tasks[0]
                # Some tasks might be marked as completed but have 'result' as null if no hotels found
                if not task.get("result"):
                    logger.info(f"DataForSEO Task {task_id} completed but had no result data (likely no matches for keyword).")
                    return {"status": "empty", "tag": task.get("tag")}

                result = task["result"][0]
                items = result.get("items", [])
                if not items:
                    return {"status": "empty", "tag": task.get("tag")}

                target = items[0]
                return {
                    "price": target.get("price", 0.0),
                    "currency": target.get("currency", "TRY"),
                    "vendor": target.get("vendor", "Direct"),
                    "property_token": target.get("hotel_identifier"),
                    "market_offers": target.get("vendors") or target.get("market_offers") or [],
                    "rating": target.get("rating", {}).get("value", 0.0),
                    "reviews": target.get("rating", {}).get("votes_count", 0),
                    "tag": task.get("tag"), 
                    "status": "success"
                }
        except Exception as e:
            logger.error(f"DataForSEO fetch_task_results error for task {task_id}: {e}")
            return None

    async def get_completed_tasks(self) -> List[str]:
        """
        Utility to find all tasks that are currently finished and ready for fetching.
        """
        if not self.login or not self.password:
            return []

        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.get(f"{self.api_url}/business_data/google/hotel_searches/tasks_ready")
                res_json = response.json()
                
                if res_json.get("status_code") == 20000 and res_json.get("tasks"):
                    # Extract IDs from the tasks_ready endpoint
                    # The structure usually contains nested task items with 'id'
                    return [t.get("id") for t in res_json.get("tasks", []) if t.get("id")]
                return []
        except Exception as e:
            logger.error(f"DataForSEO get_completed_tasks error: {e}")
            return []

# Singleton instance for system-wide use
dataforseo_provider = DataForSEOProvider()
