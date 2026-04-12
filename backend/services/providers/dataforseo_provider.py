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
                "location_code": 2792,
                "language_code": "en",
                "keyword": f"{hotel_name} {location}",
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
                    logger.error(f"DataForSEO Live Search Failed: {res_json.get('status_message')} - Task: {res_json.get('tasks', [{}])[0].get('status_message')}")
                    return {"status": "error", "error": f"{res_json.get('status_message')} - {res_json.get('tasks', [{}])[0].get('status_message')}"}

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
                market_offers = target.get("vendors") or target.get("market_offers") or []
                
                prices = target.get("prices", {})
                price_val = prices.get("price", 0.0)
                if not isinstance(price_val, (int, float)):
                    price_val = 0.0

                return {
                    "price": float(price_val),
                    "currency": prices.get("currency", currency),
                    "source": "DataForSEO",
                    "vendor": target.get("vendor", "Direct"),
                    "url": target.get("check_url", f"https://www.google.com/search?q={hotel_name}"),
                    "rating": target.get("reviews", {}).get("value", 0.0),
                    "review_count": target.get("reviews", {}).get("votes_count", 0),
                    "stars": target.get("stars", 0),
                    "images": target.get("overview_images", []),
                    "latitude": target.get("location", {}).get("latitude"),
                    "longitude": target.get("location", {}).get("longitude"),
                    "property_token": property_token,
                    "offers": market_offers,
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
        Returns a list of Task IDs for successfully accepted tasks only.
        
        IMPORTANT: The top-level status_code (20000) only means the API received
        the request. Individual tasks may still be rejected with per-task errors
        like 40501 (Invalid Field). We must check each task's status_code.
        """
        if not self.login or not self.password or not task_params:
            return None

        auth = (self.login, self.password)
        
        # Map extraction_depth to limit in payload mapping
        for task in task_params:
            if "extraction_depth" in task:
                task["limit"] = task.pop("extraction_depth")
            elif "limit" not in task:
                task["limit"] = 100
        
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=task_params
                )
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    logger.error(f"DataForSEO Task POST Failed: {res_json.get('status_message')}")
                    return None
                
                # Check each task individually - status 20100 = "Task Created"
                accepted_ids = []
                rejected_count = 0
                for task in res_json.get("tasks", []):
                    task_status = task.get("status_code")
                    if task_status == 20100:
                        task_id = task.get("id")
                        if task_id:
                            accepted_ids.append(task_id)
                    else:
                        rejected_count += 1
                        logger.warning(
                            f"DataForSEO task rejected: {task_status} - {task.get('status_message')} "
                            f"(keyword: {task.get('data', {}).get('keyword', 'unknown')})"
                        )
                
                if rejected_count > 0:
                    logger.warning(f"DataForSEO: {rejected_count}/{len(res_json.get('tasks', []))} tasks were rejected")
                
                return accepted_ids if accepted_ids else None
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
                    f"{self.api_url}/business_data/google/hotel_searches/task_get/{task_id}"
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
                task_data = task.get("data", {})
                task_tag = task_data.get("tag", task.get("tag"))

                # Some tasks might be marked as completed but have 'result' as null if no hotels found
                if not task.get("result"):
                    logger.info(f"DataForSEO Task {task_id} completed but had no result data (likely no matches for keyword).")
                    return {"status": "empty", "tag": task_tag}

                result = task["result"][0]
                items = result.get("items", [])
                if not items:
                    return {"status": "empty", "tag": task_tag}

                target = items[0]
                # hotel_searches response uses nested objects:
                #   prices: { price, currency, check_in, check_out, ... }
                #   reviews: { value, votes_count, ... }
                prices_data = target.get("prices") or {}
                reviews_data = target.get("reviews") or {}
                
                # Capture all OTA offers/vendors
                market_offers = target.get("vendors") or target.get("market_offers") or []
                
                # Check for sub_items (sometimes contains room types or secondary listings)
                room_types = target.get("sub_items", [])

                return {
                    "price": prices_data.get("price", 0.0),
                    "currency": prices_data.get("currency", "USD"),
                    "vendor": "Google aggregate",
                    "property_token": target.get("hotel_identifier"),
                    "hotel_name": target.get("title"),
                    "stars": target.get("stars"),
                    "rating": reviews_data.get("value", 0.0),
                    "reviews": reviews_data.get("votes_count", 0),
                    "offers": market_offers,
                    "room_types": room_types,
                    "tag": task_tag,
                    "items": items,
                    "status": "success"
                }
        except Exception as e:
            logger.error(f"DataForSEO fetch_task_results error for task {task_id}: {e}")
            return None

    async def get_completed_tasks(self) -> List[str]:
        """
        Utility to find all tasks that are currently finished and ready for fetching.
        
        IMPORTANT: The tasks_ready endpoint returns a wrapper structure:
        {
          "tasks": [
            {
              "id": "wrapper-meta-id",      // NOT a fetchable task ID
              "result_count": N,
              "result": [                    // Actual ready task IDs are HERE
                { "id": "real-task-id-1", "tag": "...", ... },
                { "id": "real-task-id-2", "tag": "...", ... }
              ]
            }
          ]
        }
        We must extract IDs from result[], NOT from the wrapper tasks[].
        """
        if not self.login or not self.password:
            return []

        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.get(f"{self.api_url}/business_data/google/hotel_searches/tasks_ready")
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    logger.warning(f"DataForSEO tasks_ready failed: {res_json.get('status_message')}")
                    return []
                
                ready_ids = []
                for wrapper_task in res_json.get("tasks", []):
                    result_count = wrapper_task.get("result_count", 0)
                    results = wrapper_task.get("result")
                    
                    if result_count > 0 and results:
                        for item in results:
                            task_id = item.get("id")
                            if task_id:
                                ready_ids.append(task_id)
                
                if ready_ids:
                    logger.info(f"DataForSEO: Found {len(ready_ids)} ready tasks")
                return ready_ids
        except Exception as e:
            logger.error(f"DataForSEO get_completed_tasks error: {e}")
            return []

# Singleton instance for system-wide use
dataforseo_provider = DataForSEOProvider()
