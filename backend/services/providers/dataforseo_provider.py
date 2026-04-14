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
from backend.utils.helpers import convert_currency, normalize_room_name
import unicodedata
import re

logger = get_logger(__name__)

# DataForSEO requires very specific location_name formats:
# - Country must use official API name (e.g., "Turkiye" not "Turkey")
# - No spaces after commas: "City,Country" not "City, Country"  
# - ASCII characters only: "Balikesir" not "Balıkesir"
# - language_name field is mandatory
#
# WHY THIS MATTERS:
# If the location_name contains non-ASCII characters or extra spaces, DataForSEO
# might return a 40501 "City not found" error or default to a generic global search
# which reduces accuracy for local Turkish hotels.

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
    
    This provider implements the polymorphic HotelDataProvider interface to 
    interface with the DataForSEO 'Business Data' API. 
    
    Architecture:
    - Asynchronous: Submits task_post and polls task_get later.
    - Robust: Normalizes Turkish locations and clean room names.
    - Cost-Optimized: Uses task-based batching instead of expensive Live endpoints.
    """

    def _normalize_location(self, location: str) -> str:
        """
        Normalizes location for DataForSEO API.
        
        This method performs four critical transformations:
        1. Transliterates Turkish-specific characters (ı, ğ, ü, ş, ö, ç) to ASCII.
        2. Normalizes non-spacing marks (accents).
        3. Maps common country variations (e.g., Turkey -> Turkiye) to API-supported names.
        4. Removes trailing/leading spaces from comma-separated location parts.
        
        Args:
            location: The raw location string (e.g., "İstanbul, Türkiye")
        Returns:
            A sanitized string ready for the 'location_name' API field.
        """
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

    def _normalize_room_name(self, name: str) -> Dict[str, Any]:
        """
        Cleans room names and extracts metadata attributes.
        Returns a dict: {'name': cleaned_name, 'attributes': {...}}
        """
        if not name:
            return {"name": "Standard Room", "attributes": {}}

        original = name.lower()
        attributes = {
            "is_refundable": True,
            "has_breakfast": False,
            "has_wifi": True, # Usually standard now
            "bed_type": None
        }

        # Check for non-refundable
        if any(x in original for x in ["non-refundable", "non refundable", "n/r"]):
            attributes["is_refundable"] = False
        
        # Check for breakfast
        if any(x in original for x in ["breakfast", "kahvalti", "bb", "half board", "full board"]):
            attributes["has_breakfast"] = True

        # 2. Cleaning using global helper
        cleaned = normalize_room_name(name)

        return {
            "name": cleaned,
            "original_name": name,
            "attributes": attributes
        }

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
            # Prepare task payload for DataForSEO.
            # We use the 'keyword' based approach which is most reliable for specific hotels.
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
        currency: str = "USD",
        adults: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Submits a task to the DataForSEO Google Hotels Info endpoint.
        Standard method: POST task, then GET results later.
        """
        if not self.login or not self.password or not hotel_identifier:
            return None

        auth = (self.login, self.password)
        
        post_data = [{
            "hotel_identifier": hotel_identifier,
            "language_name": "English",
            "currency": currency,
            "adults": adults
        }]

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
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
                        "message": "Hotel Information task submitted."
                    }
                
                logger.warning(f"DataForSEO Hotel Info POST failed: {res_json.get('status_message')}")
                return None

        except Exception as e:
            logger.error(f"DataForSEO fetch_hotel_info error: {e}")
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
        
        This method is the core of the background scanning system. It:
        1. Resolves hotel IDs into names/locations/tokens.
        2. Generates internal UUIDs for each scan task (used as 'tag' in DataForSEO).
        3. Breaks hotels into chunks of 100 (API limit) and posts them.
        4. Registers a 'scan_batch' in the database for UI tracking.
        5. Persists individual 'scan_tasks' cross-linking our UUID to DataForSEO task IDs.
        
        Args:
            db: Supabase client (usually service role for background).
            hotel_ids: List of hotel IDs to scan.
            check_in/out: Date strings in ISO format.
            batch_type: Metadata label for the batch.
            
        Returns:
            The number of successfully submitted and registered tasks.
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
                "total_count": len(tasks),
                "status": "processing"
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
        """Retrieves results for price search tasks."""
        return await self._fetch_results_generic(task_id, "hotel_searches")

    async def fetch_hotel_info_results(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves results for rich metadata (hotel_info) tasks."""
        raw = await self._fetch_results_generic(task_id, "hotel_info")
        if not raw or raw.get("status") != "success":
            return raw
            
        # Transform hotel_info specific fields
        items = raw.get("items", [])
        if not items: return raw
        
        target = items[0]
        return {
            "status": "success",
            "name": target.get("title"),
            "description": target.get("description"),
            "stars": target.get("stars"),
            "rating": target.get("rating", {}).get("value"),
            "amenities": target.get("amenities"),
            "check_in": target.get("check_in_time"),
            "check_out": target.get("check_out_time"),
            "property_token": target.get("hotel_identifier"),
            "raw_data": target
        }

    async def _fetch_results_generic(self, task_id: str, endpoint: str) -> Optional[Dict[str, Any]]:
        """Internal helper for GET results."""
        if not self.login or not self.password or not task_id:
            return None

        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.get(f"{self.api_url}/business_data/google/{endpoint}/task_get/{task_id}")
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    return None

                tasks = res_json.get("tasks", [])
                if not tasks:
                    return None
                    
                task = tasks[0]
                if not task.get("result"):
                    return {"status": "empty"}

                result = task["result"][0]
                items = result.get("items", [])
                
                # Default parsing for prices
                if endpoint == "hotel_searches" and items:
                    target = items[0]
                    prices_data = target.get("prices", {})
                    reviews_data = target.get("reviews", {})
                    
                    # Normalize room types if present
                    room_types_raw = target.get("room_types", [])
                    normalized_rooms = []
                    for rt in room_types_raw:
                        normalized_rooms.append(self._normalize_room_name(rt))

                    return {
                        "status": "success",
                        "price": prices_data.get("price", 0.0),
                        "currency": prices_data.get("currency", "USD"),
                        "property_token": target.get("hotel_identifier"),
                        "hotel_name": target.get("title"),
                        "stars": target.get("stars"),
                        "rating": reviews_data.get("value", 0.0),
                        "reviews": reviews_data.get("votes_count", 0),
                        "room_types": normalized_rooms,
                        "tag": task.get("data", {}).get("tag"),
                        "items": items
                    }
                
                return {"status": "success", "items": items, "tag": task.get("data", {}).get("tag")}
        except Exception as e:
            logger.error(f"DataForSEO GET error ({endpoint}): {e}")
            return None

    async def get_task_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Implementation of abstract method from HotelDataProvider.
        Attempts to fetch from searches first, then info.
        """
        # 1. Try hotel_searches (most common for pricing)
        res = await self.fetch_task_results(task_id)
        if res and res.get("status") == "success":
            return res
        
        # 2. Try hotel_info
        res_info = await self.fetch_hotel_info_results(task_id)
        if res_info and res_info.get("status") == "success":
            return res_info
            
        return res or res_info

    async def get_completed_tasks(self) -> List[str]:
        """
        Returns a list of Task IDs that are ready for retrieval.
        Used by the monitor_service process_system_scans.
        """
        return await self.get_ready_price_tasks()

    async def get_ready_price_tasks(self) -> List[str]:
        return await self._get_ready_tasks_generic("hotel_searches")

    async def get_ready_info_tasks(self) -> List[str]:
        return await self._get_ready_tasks_generic("hotel_info")

    async def _get_ready_tasks_generic(self, endpoint: str) -> List[str]:
        if not self.login or not self.password: return []
        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.get(f"{self.api_url}/business_data/google/{endpoint}/tasks_ready")
                res_json = response.json()
                if res_json.get("status_code") != 20000: return []
                
                ready_ids = []
                for wrapper in res_json.get("tasks", []):
                    results = wrapper.get("result")
                    if results:
                        ready_ids.extend([item.get("id") for item in results if item.get("id")])
                return ready_ids
        except Exception as e:
            logger.error(f"DataForSEO ready check error ({endpoint}): {e}")
            return []

# Singleton instance for system-wide use
dataforseo_provider = DataForSEOProvider()
