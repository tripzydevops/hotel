import os
import uuid
import asyncio
import httpx
import json
from datetime import date, datetime
from typing import Dict, Any, Optional, List
import traceback
from supabase import Client
from backend.services.data_provider_interface import HotelDataProvider
from backend.utils.logger import get_logger
import unicodedata

logger = get_logger(__name__)

# DataForSEO requires very specific location_name formats:
# - Country must use official API name (e.g., "Turkiye" not "Turkey")
# - No spaces after commas: "City,Country" not "City, Country"  
# - ASCII characters only: "Balikesir" not "Balıkesir"
# - language_name field is mandatory

_COUNTRY_NAME_MAP = {
    "turkey": "Turkiye",
    "türkiye": "Turkiye",
}

_TURKISH_CHAR_MAP = str.maketrans({
    'ı': 'i', 'İ': 'I',
    'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U',
    'ş': 's', 'Ş': 'S',
    'ö': 'o', 'Ö': 'O',
    'ç': 'c', 'Ç': 'C',
})

class DataForSEOProvider(HotelDataProvider):
    """
    DataForSEO Google Hotels API Provider.
    Uses HTTP Basic Authentication.
    """

    def _normalize_location(self, location: str) -> str:
        """Normalizes location for DataForSEO API."""
        if not location: return ""
        
        # 1. Transliterate Turkish characters
        loc = location.translate(_TURKISH_CHAR_MAP)
        
        # 2. General ASCII normalization
        loc = "".join(
            c for c in unicodedata.normalize('NFD', loc)
            if unicodedata.category(c) != 'Mn'
        )
        
        # 3. Handle Country Aliases
        for variant, official in _COUNTRY_NAME_MAP.items():
            if variant in loc.lower():
                import re
                loc = re.sub(re.escape(variant), official, loc, flags=re.IGNORECASE)
        
        # 4. Remove spaces after commas
        loc = ",".join([s.strip() for s in loc.split(",")])
        
        return loc

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
                "language_code": "en",
                "keyword": hotel_name,
                "check_in": check_in.strftime("%Y-%m-%d"),
                "check_out": check_out.strftime("%Y-%m-%d"),
                "currency": currency,
                "adults": adults,
                "limit": 1
            }]

            # [KAIZEN] Removed Live Queue usage to optimize cost (81% savings)
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                # Use Standard/Priority Task POST instead of Live
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=post_data
                )
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    logger.error(f"DataForSEO Task POST Failed: {res_json.get('status_message')}")
                    return {"status": "error", "error": f"{res_json.get('status_message')}"}

                task = res_json.get("tasks", [{}])[0]
                # Note: fetch_price now returns a 'pending' status because it moved to async
                return {
                    "status": "pending",
                    "task_id": task.get("id"),
                    "message": "Task submitted to standard queue. Poll fetch_task_results later."
                }
        except Exception as e:
            logger.error(f"DataForSEO Provider fetch_price Error: {e}")
            return {"status": "error", "error": str(e)}

    async def fetch_hotel_info(
        self, 
        hotel_identifier: str,
        check_in: Optional[date] = None,
        check_out: Optional[date] = None,
        currency: str = "USD",
        adults: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves detailed hotel information (amenities, images, sentiment) 
        and optionally real-time pricing using the DataForSEO Google Hotels Info Live API.
        """
        if not self.login or not self.password or not hotel_identifier:
            return None

        auth = (self.login, self.password)
        
        # Base request
        item = {
            "hotel_identifier": hotel_identifier,
            "language_name": "English",
            "currency": currency,
            "adults": adults
        }
        
        # Include dates if provided for pricing enrichment
        if check_in:
            item["check_in"] = check_in.strftime("%Y-%m-%d")
        if check_out:
            item["check_out"] = check_out.strftime("%Y-%m-%d")

        post_data = [item]

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                # [KAIZEN] Use Task POST instead of Live for Hotel Info
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/task_post",
                    json=post_data
                )
                res_json = response.json()

                if res_json.get("status_code") == 20100 or (res_json.get("status_code") == 20000 and res_json.get("tasks")):
                    task = res_json["tasks"][0]
                    return {
                        "status": "pending",
                        "task_id": task.get("id"),
                        "message": "Hotel Information task submitted to queue."
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

    async def post_price_tasks(self, task_params: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
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
                
                # Return the full task list for more detailed tracking
                return res_json.get("tasks", []) if accepted_ids else None
        except Exception as e:
            logger.error(f"DataForSEO post_price_tasks error: {e}")
            return None

    async def submit_hotel_scan_batch(
        self,
        db: Client,
        hotel_ids: List[str],
        check_in: str,
        check_out: str,
        batch_type: str = "scheduled_pulse"
    ) -> int:
        """
        High-level batch submission for the system heartbeat.
        Prepares keywords based on hotel names/locations, posts tasks,
        and registers them in the monitor_tasks table.
        """
        if not hotel_ids:
            return 0

        # 1. Fetch hotel metadata for keywords
        try:
            hotels_res = db.table("hotels").select("id, name, location, property_token") \
                .in_("id", hotel_ids) \
                .execute()
            
            hotel_map = {str(h["id"]): h for h in (hotels_res.data or [])}
        except Exception as e:
            logger.error(f"BatchSubmit: Failed to fetch metadata: {e}")
            return 0

        # 2. Prepare Task Params
        task_params = []
        hotel_task_map = {} # Maps internal UUID to hotel_id for later matching
        
        for hid in hotel_ids:
            hotel = hotel_map.get(str(hid))
            if not hotel:
                continue
            
            # [KAIZEN 2026] Use property_token for pinpoint accuracy if available
            keyword = hotel.get("property_token")
            if not keyword:
                keyword = f"{hotel['name']} {hotel['location']}"
            
            loc = hotel.get("location") or "Turkiye"
            normalized_loc = self._normalize_location(loc)

            # Create a unique tag for this specific hotel scan
            scan_task_uuid = str(uuid.uuid4())
            hotel_task_map[scan_task_uuid] = hid
            
            task_params.append({
                "keyword": keyword,
                "location_name": normalized_loc,
                "language_name": "English", # standard for hotel searches
                "check_in": check_in,
                "check_out": check_out,
                "currency": "TRY",
                "tag": scan_task_uuid
            })

        if not task_params:
            return 0

        # 3. Post to DataForSEO in Chunks (DataForSEO limit is 100 per POST)
        CHUNK_SIZE = 100
        all_tasks = []
        
        for i in range(0, len(task_params), CHUNK_SIZE):
            chunk = task_params[i:i + CHUNK_SIZE]
            logger.info(f"Posting scan chunk {i//CHUNK_SIZE + 1} ({len(chunk)} hotels)")
            chunk_tasks = await self.post_price_tasks(chunk)
            if chunk_tasks:
                all_tasks.extend(chunk_tasks)

        if not all_tasks:
            return 0

        tasks = all_tasks

        # 4. Register in scan_tasks for persistence pipeline
        try:
            # Create a batch record for tracking
            batch_res = db.table("scan_batches").insert({
                "total_tasks": len(tasks),
                "status": "processing",
                "type": batch_type
            }).execute()
            batch_id = batch_res.data[0]["id"] if batch_res.data else None

            scan_tasks = []
            for t in tasks:
                if t.get("status_code") == 20100:
                    # Retrieve our generated UUID from 'tag'
                    # Warning: DataForSEO API returns the original request data inside 'data' field
                    req_data = t.get("data", {})
                    tag = req_data.get("tag")
                    
                    if tag and tag in hotel_task_map:
                        scan_tasks.append({
                            "id": tag, # We reuse our generated UUID as DB primary key
                            "external_task_id": t["id"],
                            "hotel_id": hotel_task_map[tag],
                            "batch_id": batch_id,
                            "status": "pending"
                        })
            
            if scan_tasks:
                db.table("scan_tasks").insert(scan_tasks).execute()
                return len(scan_tasks)
        except Exception as e:
            logger.error(f"BatchSubmit: Failed to register tasks/batch in DB: {e}")
        
        return 0

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
                # DataForSEO Google Hotels Search usually puts offers in target['vendors']
                # or nested inside target['prices']['items']
                market_offers = target.get("vendors") or target.get("market_offers") or []
                
                # If offers list is empty, dive into prices.items which often contains the OTA list
                if not market_offers and "items" in prices_data:
                    for p_item in prices_data["items"]:
                        offer = {
                            "vendor": p_item.get("source"),
                            "price": p_item.get("price"),
                            "currency": p_item.get("currency"),
                            "url": p_item.get("url"),
                            "is_official": p_item.get("is_official", False)
                        }
                        market_offers.append(offer)

                # Check for sub_items (sometimes contains room types or secondary listings)
                room_types = target.get("sub_items", [])
                
                # Deduce room types from prices items if available (extracting unique names)
                if not room_types and "items" in prices_data:
                    seen_rooms = set()
                    for p_item in prices_data["items"]:
                        r_name = p_item.get("name") # Some providers put room name here
                        if r_name and r_name not in seen_rooms:
                            room_types.append({"name": r_name, "price": p_item.get("price")})
                            seen_rooms.add(r_name)

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
                    "check_in": prices_data.get("check_in"),
                    "check_out": prices_data.get("check_out"),
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
