import os
import uuid
import asyncio
import httpx
import json
from datetime import date, datetime, timedelta
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

    def _normalize_sentiment_breakdown(self, breakdown: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Standardizes DataForSEO reviews_breakdown to internal SentimentBreakdown schema.
        
        KAIZEN: Implements the confirmed 'Dynamic Extension' strategy.
        - Core categories ('Cleanliness', 'Service', etc.) are mapped to schema keys.
        - Unknown categories are preserved with snake_case normalization.
        """
        if not breakdown:
            return []
            
        # Standard mapping for common Google categories
        CORE_MAPPING = {
            "Cleanliness": "cleanliness",
            "Service": "service",
            "Location": "location",
            "Value": "value",
            "Rooms": "rooms",
            "Dining": "dining",
            "Facilities": "facilities",
        }
        
        normalized = []
        for category, score in breakdown.items():
            if not isinstance(score, (int, float)):
                continue
                
            internal_key = CORE_MAPPING.get(category, category.lower().replace(" ", "_"))
            
            # Simple sentiment inference if none provided
            sentiment = "neutral"
            if score >= 4.0:
                sentiment = "positive"
            elif score < 3.0:
                sentiment = "negative"
                
            normalized.append({
                "category": internal_key,
                "display_name": category,
                "rating": round(float(score), 1),
                "sentiment": sentiment,
                "total_mentioned": 0 # Not provided by info/advanced currently
            })
            
        return normalized

    def __init__(self):
        self.login = os.getenv("DATAFORSEO_LOGIN")
        self.password = os.getenv("DATAFORSEO_PASSWORD")
        self.api_url = "https://api.dataforseo.com/v3"
        
        if not self.login or not self.password:
            logger.warning("DataForSEO credentials missing from environment.")

    def get_provider_name(self) -> str:
        return "DataForSEO"

    def _parse_advanced_hotel_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts high-fidelity metadata and sentiment from hotel_info/advanced response.
        """
        info = data.get("hotel_info", {})
        reviews = data.get("reviews", {})
        
        # 1. Normalize Sentiment Breakdown
        sentiment_breakdown = []
        raw_sentiment = reviews.get("sentiment") or {}
        
        if not raw_sentiment and reviews.get("review_mentions"):
            for mention in reviews.get("review_mentions", []):
                name = mention.get("title", "Other")
                pos = mention.get("positive_count", 0)
                neg = mention.get("negative_count", 0)
                if pos + neg > 0:
                    sentiment_breakdown.append({
                        "name": self._normalize_sentiment_name(name),
                        "positive": pos,
                        "negative": neg,
                        "total": pos + neg
                    })
        else:
            for category, stats in raw_sentiment.items():
                pos = stats.get("positive", 0)
                neg = stats.get("negative", 0)
                if pos + neg > 0:
                    sentiment_breakdown.append({
                        "name": self._normalize_sentiment_name(category),
                        "positive": pos,
                        "negative": neg,
                        "total": pos + neg
                    })

        # 2. Enrich Room Catalog (High Detail)
        room_catalog = []
        items = data.get("items", [])
        for item in items:
            if item.get("type") == "hotel_item":
                image_url = None
                if item.get("images"):
                    image_url = item["images"][0]
                
                room_catalog.append({
                    "name": item.get("title"),
                    "price": item.get("price_raw") or item.get("price"),
                    "currency": item.get("currency"),
                    "source": item.get("source"),
                    "url": item.get("url"),
                    "capacity": item.get("capacity"),
                    "features": item.get("features"),
                    "image_url": image_url
                })

        # 3. Amenities normalization
        amenities = [a.get("amenity") for a in info.get("amenities", []) if a.get("amenity")]

        # 4. Extract Hotel Images
        hotel_images = info.get("images", [])
        image_url = hotel_images[0] if hotel_images else None

        # Fallback Rating Logic
        rating = reviews.get("average_rating")
        if not rating and info.get("rating"):
            rating = info["rating"].get("value")
            
        reviews_count = reviews.get("reviews_count")
        if not reviews_count and info.get("rating"):
            reviews_count = info["rating"].get("votes_count")

        # Rating Distribution
        rating_distribution = info.get("rating", {}).get("rating_distribution")
        if not rating_distribution:
            rating_distribution = reviews.get("rating_distribution")

        return {
            "name": info.get("title"),
            "stars": info.get("stars"),
            "rating": rating,
            "reviews_count": reviews_count,
            "description": info.get("description"),
            "amenities": amenities,
            "image_url": image_url,
            "images": hotel_images,
            "check_in_time": info.get("check_in_time"),
            "check_out_time": info.get("check_out_time"),
            "phone": info.get("phone"),
            "website": info.get("website"),
            "address": info.get("address"),
            "latitude": info.get("latitude"),
            "longitude": info.get("longitude"),
            "sentiment_breakdown": sentiment_breakdown,
            "room_catalog": room_catalog,
            "room_types": [r["name"] for r in room_catalog if r.get("name")],
            "best_price": info.get("prices", {}).get("price"),
            "currency": info.get("prices", {}).get("currency"),
            "rating_distribution": rating_distribution,
            "raw_data": data # Full result block
        }

    def _normalize_sentiment_name(self, name: str) -> str:
        """
        Normalizes localized category names (e.g. Turkish) to English.
        """
        from backend.utils.sentiment_utils import TR_MAP
        clean_name = name.strip().title()
        return TR_MAP.get(clean_name, clean_name)

    async def get_hotel_details_advanced(
        self,
        hotel_id_on_provider: str,
        location_name: str,
        language_code: str = "en",
        check_in: str = None,
        check_out: str = None,
        adults: int = 2,
        currency: str = "TRY"
    ) -> Dict[str, Any]:
        """
        Deep scan using hotel_info/advanced.
        Provides detailed sentiment and enriched metadata.
        """
        payload = [
            {
                "hotel_id": hotel_id_on_provider,
                "location_name": location_name,
                "language_code": language_code,
                "check_in": check_in,
                "check_out": check_out,
                "adults": adults,
                "currency": currency,
            }
        ]

        logger.info(f"DataForSEO Advanced Request: {hotel_id_on_provider} in {location_name}")
        
        try:
            # Note: Using the base provider's POST method which handles auth and retries
            # The tool mcp_dataforseo_serp_organic_live_advanced is Google specific,
            # so we use raw HTTP for the specialized hotel endpoints.
            from backend.services.providers.dataforseo_provider import DataForSEOProvider
            
            # This is a bit recursive since we are in the class, 
            # but we assume the standard pattern for shared API clients.
            endpoint = "https://api.dataforseo.com/v3/business_data/google/hotel_info/advanced/live"
            
            # Use task-based async fetch if available, else standard requests
            # For this execution, we use the provider's established session.
            response = await self._post_v3_request(endpoint, payload)
            
            if response and response.get("tasks"):
                task = response["tasks"][0]
                if task.get("result"):
                    result = task["result"][0]
                    return self._parse_advanced_hotel_info(result)
            
            return {"status": "error", "message": "No data returned from Advanced API"}
            
        except Exception as e:
            logger.error(f"Advanced scan failed: {e}")
            return {"status": "error", "message": str(e)}

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
                "location_name": self._normalize_location(location),
                "language_code": "en",
                "keyword": hotel_name,
                "check_in": check_in.strftime("%Y-%m-%d"),
                "check_out": check_out.strftime("%Y-%m-%d"),
                "currency": currency,
                "adults": adults,
                "limit": 1
            }]

            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=post_data
                )
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    logger.error(f"DataForSEO Task POST Failed: {res_json.get('status_message')}")
                    return {"status": "error", "error": f"{res_json.get('status_message')}"}

                task = res_json.get("tasks", [{}])[0]
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
                    f"{self.api_url}/business_data/google/hotel_info/advanced/task_post",
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
        """Submits multiple hotel search tasks to DataForSEO."""
        if not self.login or not self.password or not task_params:
            return None

        auth = (self.login, self.password)
        
        # Map extraction_depth to limit in payload mapping
        modified_params = []
        for t in task_params:
            task = t.copy()
            if "extraction_depth" in task:
                task["limit"] = task.pop("extraction_depth")
            elif "limit" not in task:
                task["limit"] = 100
            modified_params.append(task)
        
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=modified_params
                )
                res_json = response.json()
                
                if res_json.get("status_code") != 20000:
                    logger.error(f"DataForSEO Task POST Failed: {res_json.get('status_message')}")
                    return None
                
                return res_json.get("tasks", [])
        except Exception as e:
            logger.error(f"DataForSEO post_price_tasks error: {e}")
            return None

    async def post_info_tasks(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch posts hotel metadata tasks to DataForSEO."""
        if not self.login or not self.password: return []
        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/task_post",
                    json=tasks
                )
                if response.status_code != 200 or response.json().get("status_code") != 20100:
                    logger.error(f"DataForSEO info POST error: {response.status_code} - {response.text}")
                res_json = response.json()
                return res_json.get("tasks", [])
        except Exception as e:
            logger.error(f"DataForSEO info POST exception: {e}")
            return []

    async def post_hotel_tokens(self, property_tokens: List[str], location_name: Optional[str] = "Turkiye") -> Optional[List[str]]:
        """
        POSTs property tokens to DataForSEO Google Hotels endpoint.
        Returns ONLY the task IDs from the API response.
        """
        if not self.login or not self.password or not property_tokens:
            return None

        auth = (self.login, self.password)
        tasks = [
            {
                "hotel_identifier": token,
                "location_name": self._normalize_location(location_name),
                "language_name": "English"
            }
            for token in property_tokens
        ]

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/task_post",
                    json=tasks
                )
                res_json = response.json()
                
                # DataForSEO returns 20100 for successful completion or submission
                if res_json.get("status_code") not in [20000, 20100]:
                    logger.error(f"DataForSEO post_hotel_tokens Failed: {res_json.get('status_message')}")
                    return None
                
                return [t.get("id") for t in res_json.get("tasks", []) if t.get("id")]
        except Exception as e:
            logger.error(f"DataForSEO post_hotel_tokens error: {e}")
            return None

    async def submit_hotel_scan_batch(
        self,
        db: Client,
        hotel_ids: List[str],
        check_in: str,
        check_out: str,
        batch_type: str = "scheduled_pulse",
        deep_scan: bool = False
    ) -> int:
        """
        High-level batch submission for the system heartbeat.
        If deep_scan=True, it submits both Pricing AND Metadata/Sentiment tasks.
        """
        if not hotel_ids:
            return 0

        # 1. Fetch hotel metadata for keywords
        try:
            hotels_res = db.table("hotels").select("id, name, location, property_token, serp_api_id") \
                .in_("id", hotel_ids) \
                .execute()
            
            hotels = hotels_res.data or []
        except Exception as e:
            logger.error(f"BatchSubmit: Failed to fetch metadata: {e}")
            return 0

        hotel_task_map = {}
        price_task_params = []
        info_task_params = []
        
        for hotel in hotels:
            hid = str(hotel.get("id"))
            
            # [KAIZEN 2026] Prioritize serp_api_id (Google Hotel ID) for absolute accuracy
            keyword = hotel.get("serp_api_id")
            if not keyword:
                keyword = hotel.get("property_token")
            
            if not keyword:
                keyword = f"{hotel['name']} {hotel['location']}"
            
            loc = hotel.get("location") or "Turkiye"
            normalized_loc = self._normalize_location(loc)

            # Price Task (Always submitted)
            price_uuid = str(uuid.uuid4())
            hotel_task_map[price_uuid] = hid
            price_task_params.append({
                "keyword": keyword,
                "location_name": normalized_loc,
                "language_name": "English",
                "check_in": check_in,
                "check_out": check_out,
                "currency": "TRY",
                "tag": price_uuid
            })

            # Info Task (Only if deep_scan)
            if deep_scan:
                info_uuid = str(uuid.uuid4())
                hotel_task_map[info_uuid] = hid
                
                # Correct key for hotel_info is 'hotel_identifier', not 'keyword'
                # unless we are doing a keyword search, but with property_token it must be hotel_identifier.
                info_task_params.append({
                    "hotel_identifier": keyword if (hotel.get("serp_api_id") or hotel.get("property_token")) else None,
                    "keyword": None if (hotel.get("serp_api_id") or hotel.get("property_token")) else keyword,
                    "location_name": normalized_loc,
                    "language_name": "English",
                    "tag": info_uuid
                })

        CHUNK_SIZE = 100
        total_submitted = 0
        
        # Prices
        for i in range(0, len(price_task_params), CHUNK_SIZE):
            chunk = price_task_params[i:i + CHUNK_SIZE]
            res = await self.post_price_tasks(chunk)
            if res:
                total_submitted += await self._register_scan_tasks(db, res, hotel_task_map, "price_search")

        # Info
        if info_task_params:
            for i in range(0, len(info_task_params), CHUNK_SIZE):
                chunk = info_task_params[i:i + CHUNK_SIZE]
                res = await self.post_info_tasks(chunk)
                if res:
                    total_submitted += await self._register_scan_tasks(db, res, hotel_task_map, "hotel_info")

        return total_submitted

    async def _register_scan_tasks(self, db: Client, tasks: List[Dict[str, Any]], mapping: Dict[str, str], task_type: str) -> int:
        """Helper to register external tasks into internal scan_tasks table."""
        try:
            batch_res = db.table("scan_batches").insert({
                "total_count": len(tasks),
                "status": "processing",
                "batch_type": task_type
            }).execute()
            batch_id = batch_res.data[0]["id"] if batch_res.data else None

            scan_tasks = []
            for t in tasks:
                if t.get("status_code") == 20100:
                    req_data = t.get("data", {})
                    tag = req_data.get("tag")
                    if tag and tag in mapping:
                        scan_tasks.append({
                            "id": tag,
                            "external_task_id": t["id"],
                            "hotel_id": mapping[tag],
                            "batch_id": batch_id,
                            "status": "pending",
                            "task_type": task_type
                        })
            
            if scan_tasks:
                db.table("scan_tasks").insert(scan_tasks).execute()
                return len(scan_tasks)
            return 0
        except Exception as e:
            logger.error(f"Failed to register scan tasks: {e}")
            return 0

    async def fetch_task_results(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves results for price search tasks."""
        return await self._fetch_results_generic(task_id, "hotel_searches")

    async def fetch_hotel_info_results(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves results for rich metadata (hotel_info) tasks from advanced endpoint."""
        raw = await self._fetch_results_generic(task_id, "hotel_info/advanced")
        return raw

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
                if not tasks: return None
                    
                task = tasks[0]
                if not task.get("result"): 
                    return {
                        "status": "success", 
                        "items": [], 
                        "tag": (task.get("data") or {}).get("tag"),
                        "task_type": "price_search" if "hotel_searches" in endpoint else "hotel_info"
                    }

                result = task["result"][0]
                items = result.get("items", [])
                
                if (endpoint == "hotel_searches" or endpoint == "hotel_search") and items:
                    target = items[0]
                    prices_data = target.get("prices", {})
                    reviews_data = target.get("reviews", {})
                    
                    # Room Types Extraction
                    room_types_raw = target.get("room_types", [])
                    normalized_rooms = [self._normalize_room_name(rt) for rt in room_types_raw]

                    # OTA Parity / All Prices
                    raw_prices = prices_data.get("items", []) or []
                    PRIORITY_OTAS = ["Booking.com", "Expedia", "Agoda", "Hotels.com", "Airbnb", "Otelz.com", "Jolly Tur"]
                    
                    def ota_priority(item):
                        # DataForSEO might use 'source' or 'vendor'
                        source = item.get("source") or item.get("vendor") or ""
                        try:
                            for idx, prio in enumerate(PRIORITY_OTAS):
                                if prio.lower() in source.lower():
                                    return idx
                            return 999
                        except Exception:
                            return 999
                    
                    sorted_prices = sorted(raw_prices, key=ota_priority)
                    
                    # Sentiment Fallback
                    search_sentiment = target.get("reviews_breakdown", {}).get("sentiment", [])

                    return {
                        "status": "success",
                        "task_type": "price_search",
                        "price": prices_data.get("price", 0.0),
                        "currency": prices_data.get("currency", "USD"),
                        "property_token": target.get("hotel_identifier"),
                        "hotel_name": target.get("title"),
                        "stars": target.get("stars"),
                        "rating": reviews_data.get("value", 0.0),
                        "reviews": reviews_data.get("votes_count", 0),
                        "room_types": normalized_rooms,
                        "tag": (task.get("data") or {}).get("tag"),
                        "all_prices": sorted_prices,
                        "parity_offers": sorted_prices,
                        "sentiment_breakdown": search_sentiment,
                        "raw_data": target, # Full raw item for archival
                        "items": items
                    }
                
                if "hotel_info" in endpoint and items:
                    # Unified Parsing for Advanced Hotel Info
                    parsed = self._parse_advanced_hotel_info(result)
                    return {
                        "status": "success",
                        "task_type": "hotel_info",
                        "tag": (task.get("data") or {}).get("tag"),
                        **parsed
                    }
                
                return {"status": "success", "items": items, "tag": (task.get("data") or {}).get("tag")}
        except Exception as e:
            logger.error(f"DataForSEO GET error ({endpoint}): {e}")
            return None

    async def get_task_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Implementation of abstract method from HotelDataProvider."""
        res = await self.fetch_task_results(task_id)
        if res and res.get("status") == "success": return res
        
        res_info = await self.fetch_hotel_info_results(task_id)
        if res_info and res_info.get("status") == "success": return res_info
            
        return res or res_info

    async def get_completed_tasks(self) -> List[str]:
        """Returns a list of Task IDs that are ready for retrieval across all endpoints."""
        tasks = await asyncio.gather(
            self._get_ready_tasks_generic("hotel_searches"),
            self._get_ready_tasks_generic("hotel_info/advanced"),
            return_exceptions=True
        )
        
        all_ids = []
        for res in tasks:
            if isinstance(res, list):
                all_ids.extend(res)
        return all_ids

    async def _get_ready_tasks_generic(self, endpoint: str) -> List[str]:
        """Internal helper for pooling ready tasks."""
        if not self.login or not self.password: return []
        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
                response = await client.get(f"{self.api_url}/business_data/google/{endpoint}/tasks_ready")
                res_json = response.json()
                if res_json.get("status_code") == 20000:
                    return [t.get("id") for t in res_json.get("tasks", []) if t.get("id")]
                return []
        except Exception as e:
            logger.error(f"DataForSEO ready tasks error ({endpoint}): {e}")
            return []

# Global instance for service usage
dataforseo_provider = DataForSEOProvider()

