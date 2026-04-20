import asyncio
import os
import re
import unicodedata
import uuid
from datetime import date
from typing import Any, Dict, List, Optional

import httpx

from backend.services.data_provider_interface import HotelDataProvider
from backend.utils.helpers import normalize_room_name
from backend.utils.logger import get_logger
from supabase import Client

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

_TURKISH_CHAR_MAP = str.maketrans(
    {
        "ı": "i",
        "İ": "I",
        "ğ": "g",
        "Ğ": "G",
        "ü": "u",
        "Ü": "U",
        "ş": "s",
        "Ş": "S",
        "ö": "o",
        "Ö": "O",
        "ç": "c",
        "Ç": "C",
    }
)


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
        if not location:
            return ""

        # 1. Transliterate Turkish characters
        loc = location.translate(_TURKISH_CHAR_MAP)

        # 2. General ASCII normalization
        loc = "".join(
            c
            for c in unicodedata.normalize("NFD", loc)
            if unicodedata.category(c) != "Mn"
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
            "has_wifi": True,  # Usually standard now
            "bed_type": None,
        }

        # Check for non-refundable
        if any(x in original for x in ["non-refundable", "non refundable", "n/r"]):
            attributes["is_refundable"] = False

        # Check for breakfast
        if any(
            x in original
            for x in ["breakfast", "kahvalti", "bb", "half board", "full board"]
        ):
            attributes["has_breakfast"] = True

        # 2. Cleaning using global helper
        cleaned = normalize_room_name(name)

        return {"name": cleaned, "original_name": name, "attributes": attributes}

    def _normalize_sentiment_breakdown(
        self, breakdown: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
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

            internal_key = CORE_MAPPING.get(
                category, category.lower().replace(" ", "_")
            )

            # Simple sentiment inference if none provided
            sentiment = "neutral"
            if score >= 4.0:
                sentiment = "positive"
            elif score < 3.0:
                sentiment = "negative"

            normalized.append(
                {
                    "category": internal_key,
                    "display_name": category,
                    "rating": round(float(score), 1),
                    "sentiment": sentiment,
                    "total_mentioned": 0,  # Not provided by info/advanced currently
                }
            )

        return normalized

    def __init__(self):
        self.login = os.getenv("DATAFORSEO_LOGIN")
        self.password = os.getenv("DATAFORSEO_PASSWORD")
        self.api_url = "https://api.dataforseo.com/v3"

        if not self.login or not self.password:
            logger.warning("DataForSEO credentials missing from environment.")

    async def _post_v3_request(
        self, endpoint: str, payload: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Handles authentication and POST request for v3 API."""
        if not self.login or not self.password:
            return None

        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(endpoint, json=payload)
                if response.status_code == 200:
                    return response.json()
                logger.error(
                    f"DataForSEO error: {response.status_code} - {response.text}"
                )
        except Exception as e:
            logger.error(f"DataForSEO request failed: {e}")
        return None

    async def search_location(self, location_name: str) -> Optional[int]:
        """
        Search for a location_code based on a string (e.g. 'San Francisco, CA').
        Returns the most relevant location_code.
        """
        # Normalize for DataForSEO (Turkish characters, Turkiye mapping, comma spacing)
        sanitized_name = self._normalize_location(location_name)

        endpoint = f"{self.api_url}/serp/google/locations"
        payload = [{"location_name": sanitized_name, "limit": 1}]

        response = await self._post_v3_request(endpoint, payload)
        if response and response.get("tasks"):
            for task in response["tasks"]:
                if task.get("result"):
                    for item in task["result"]:
                        if item.get("location_code"):
                            return int(item["location_code"])

        # Fallback recursive logic: try parts of the location
        if "," in sanitized_name:
            parts = sanitized_name.split(",")
            # 1. Try first part (usually the city or district)
            city_only = parts[0]
            payload = [{"location_name": city_only, "limit": 1}]
            response = await self._post_v3_request(endpoint, payload)
            if response and response.get("tasks"):
                for task in response["tasks"]:
                    if task.get("result"):
                        for item in task["result"]:
                            if item.get("location_code"):
                                return int(item["location_code"])

            # 2. Try second part if first part failed (likely the province/state if first was a district)
            if len(parts) > 1:
                province_only = parts[1]
                payload = [{"location_name": province_only, "limit": 1}]
                response = await self._post_v3_request(endpoint, payload)
                if response and response.get("tasks"):
                    for task in response["tasks"]:
                        if task.get("result"):
                            for item in task["result"]:
                                if item.get("location_code"):
                                    return int(item["location_code"])

        return None

    def get_provider_name(self) -> str:
        return "DataForSEO"

    def _parse_advanced_hotel_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts high-fidelity metadata and sentiment from hotel_info/advanced response.

        ACTUAL API structure (result[0] level):
          - about: {description, sub_descriptions, check_in_time, check_out_time, amenities, popular_amenities, ...}
          - reviews: {value, votes_count, mentions, rating_distribution, other_sites_reviews}
          - prices: {price, currency, check_in, check_out, items: [{type, title, price, currency, source_url, ...}]}
          - overview_images: [url, ...]
          - title, stars, stars_description, address, phone, location: {latitude, longitude, ...}

        FALLBACK: Also handles legacy nested structure (data.hotel_info, data.reviews)
        """
        # === Detect response shape ===
        # New shape: top-level keys (about, reviews dict with 'value', prices with 'items')
        # Legacy shape: hotel_info, reviews dict with 'average_rating'
        is_top_level = bool(
            data.get("about")
            or (
                isinstance(data.get("reviews"), dict)
                and "value" in (data.get("reviews") or {})
            )
        )

        if is_top_level:
            about = data.get("about", {})
            reviews_obj = data.get("reviews", {})
            prices_obj = data.get("prices", {})
            location_obj = data.get("location", {})
        else:
            # Legacy fallback
            about = data.get("hotel_info", {})
            reviews_obj = data.get("reviews", {})
            prices_obj = about.get("prices", {})
            location_obj = {}

        # === 1. Core Metadata ===
        title = data.get("title") or about.get("title") or about.get("name")
        stars = data.get("stars") or about.get("stars")
        description = about.get("description")
        address = (
            data.get("address") or about.get("full_address") or about.get("address")
        )
        phone = data.get("phone") or about.get("phone")
        website = about.get("url") or about.get("website")
        check_in_time = about.get("check_in_time")
        check_out_time = about.get("check_out_time")

        # Coordinates
        latitude = location_obj.get("latitude") or about.get("latitude")
        longitude = location_obj.get("longitude") or about.get("longitude")

        # === 2. Rating & Reviews ===
        if is_top_level:
            rating = reviews_obj.get("value")
            reviews_count = reviews_obj.get("votes_count")
        else:
            rating = reviews_obj.get("average_rating")
            if not rating and about.get("rating"):
                rating = about["rating"].get("value")
            reviews_count = reviews_obj.get("reviews_count")
            if not reviews_count and about.get("rating"):
                reviews_count = about["rating"].get("votes_count")

        # Rating Distribution
        rating_distribution = reviews_obj.get("rating_distribution")
        if not rating_distribution and isinstance(about.get("rating"), dict):
            rating_distribution = about["rating"].get("rating_distribution")

        # === 3. Review Mentions → Sentiment Breakdown ===
        sentiment_breakdown = []
        mentions_raw = (
            reviews_obj.get("mentions") or reviews_obj.get("review_mentions") or []
        )

        for mention in mentions_raw:
            name = mention.get("title") or mention.get("name", "Other")
            pos = mention.get("positive_count", 0)
            neg = mention.get("negative_count", 0)
            total = pos + neg
            if total > 0:
                sentiment_breakdown.append(
                    {
                        "name": self._normalize_sentiment_name(name),
                        "positive": pos,
                        "negative": neg,
                        "total": total,
                    }
                )

        # Fallback to sentiment dict if no mentions
        if not sentiment_breakdown:
            raw_sentiment = reviews_obj.get("sentiment") or {}
            for category, stats in raw_sentiment.items():
                if isinstance(stats, dict):
                    pos = stats.get("positive", 0)
                    neg = stats.get("negative", 0)
                    if pos + neg > 0:
                        sentiment_breakdown.append(
                            {
                                "name": self._normalize_sentiment_name(category),
                                "positive": pos,
                                "negative": neg,
                                "total": pos + neg,
                            }
                        )

        # Guest Mentions (raw for storage)
        guest_mentions = mentions_raw if mentions_raw else None

        # === 4. Other Sites Reviews (Booking.com, Tripadvisor, etc.) ===
        other_sites_reviews = reviews_obj.get("other_sites_reviews") or []

        # === 5. Amenities ===
        amenities = []
        raw_amenities = about.get("amenities") or about.get("popular_amenities") or []
        if isinstance(raw_amenities, list):
            for group in raw_amenities:
                if isinstance(group, dict):
                    # Grouped format: {category: "Pool", items: ["Indoor pool", ...]}
                    cat_name = group.get("category") or group.get("title", "")
                    items = group.get("items") or group.get("amenities") or []
                    if items and isinstance(items, list):
                        for it in items:
                            if isinstance(it, str):
                                amenities.append(it)
                            elif isinstance(it, dict):
                                amenities.append(
                                    it.get("amenity") or it.get("title") or str(it)
                                )
                    elif cat_name:
                        amenities.append(cat_name)
                elif isinstance(group, str):
                    amenities.append(group)

        # Fallback legacy flat format
        if not amenities and isinstance(about.get("amenities"), list):
            amenities = [
                a.get("amenity")
                for a in about["amenities"]
                if isinstance(a, dict) and a.get("amenity")
            ]

        # === 6. OTA Price Items ===
        ota_prices = []
        price_items = prices_obj.get("items") or []
        for pi in price_items:
            if isinstance(pi, dict):
                ota_prices.append(
                    {
                        "source": pi.get("title") or pi.get("source"),
                        "price": pi.get("price"),
                        "currency": pi.get("currency"),
                        "url": pi.get("source_url") or pi.get("url"),
                        "type": pi.get("type", "hotel_info_price"),
                    }
                )

        # === 7. Images ===
        overview_images = data.get("overview_images") or []
        hotel_images = about.get("images") or overview_images or []
        image_url = hotel_images[0] if hotel_images else None

        # === 8. Room Catalog (from items array if present) ===
        room_catalog = []
        items = data.get("items") or []
        for item in items:
            if isinstance(item, dict) and item.get("type") == "hotel_item":
                img = None
                if item.get("images"):
                    img = item["images"][0]
                room_catalog.append(
                    {
                        "name": item.get("title"),
                        "price": item.get("price_raw") or item.get("price"),
                        "currency": item.get("currency"),
                        "source": item.get("source"),
                        "url": item.get("url"),
                        "capacity": item.get("capacity"),
                        "features": item.get("features"),
                        "image_url": img,
                    }
                )

        # === 9. Best Price from prices object ===
        best_price = prices_obj.get("price")
        currency = prices_obj.get("currency")

        logger.info(
            f"DataForSEO AdvancedParser: title={title}, stars={stars}, rating={rating}, "
            f"reviews={reviews_count}, amenities={len(amenities)}, "
            f"ota_prices={len(ota_prices)}, mentions={len(sentiment_breakdown)}, "
            f"rooms={len(room_catalog)}, images={len(hotel_images)}, "
            f"other_site_reviews={len(other_sites_reviews)}"
        )

        return {
            "name": title,
            "stars": stars,
            "rating": rating,
            "reviews_count": reviews_count,
            "description": description,
            "amenities": amenities,
            "image_url": image_url,
            "images": hotel_images,
            "check_in_time": check_in_time,
            "check_out_time": check_out_time,
            "phone": phone,
            "website": website,
            "address": address,
            "latitude": latitude,
            "longitude": longitude,
            "sentiment_breakdown": sentiment_breakdown,
            "guest_mentions": guest_mentions,
            "other_sites_reviews": other_sites_reviews,
            "ota_prices": ota_prices,
            "room_catalog": room_catalog,
            "room_types": [r["name"] for r in room_catalog if r.get("name")],
            "best_price": best_price,
            "currency": currency,
            "rating_distribution": rating_distribution,
            "raw_data": data,
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
        currency: str = "TRY",
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

        logger.info(
            f"DataForSEO Advanced Request: {hotel_id_on_provider} in {location_name}"
        )

        try:
            # Note: Using the base provider's POST method which handles auth and retries
            # The tool mcp_dataforseo_serp_organic_live_advanced is Google specific,
            # so we use raw HTTP for the specialized hotel endpoints.

            # This is a bit recursive since we are in the class,
            # but we assume the standard pattern for shared API clients.
            endpoint = "https://api.dataforseo.com/v3/business_data/google/hotel_info/advanced/live"

            # Use task-based async fetch if available, else standard requests
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
            post_data = [
                {
                    "location_name": self._normalize_location(location),
                    "language_code": "en",
                    "keyword": hotel_name,
                    "check_in": check_in.strftime("%Y-%m-%d"),
                    "check_out": check_out.strftime("%Y-%m-%d"),
                    "currency": currency,
                    "adults": adults,
                    "limit": 1,
                }
            ]

            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=post_data,
                )
                res_json = response.json()

                if res_json.get("status_code") != 20000:
                    logger.error(
                        f"DataForSEO Task POST Failed: {res_json.get('status_message')}"
                    )
                    return {
                        "status": "error",
                        "error": f"{res_json.get('status_message')}",
                    }

                task = res_json.get("tasks", [{}])[0]
                return {
                    "status": "pending",
                    "task_id": task.get("id"),
                    "message": "Task submitted to standard queue. Poll fetch_task_results later.",
                }
        except Exception as e:
            logger.error(f"DataForSEO Provider fetch_price Error: {e}")
            return {"status": "error", "error": str(e)}

    async def fetch_hotel_info(
        self, hotel_identifier: str, currency: str = "USD", adults: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Submits a task to the DataForSEO Google Hotels Info endpoint.
        Standard method: POST task, then GET results later.
        """
        if not self.login or not self.password or not hotel_identifier:
            return None

        auth = (self.login, self.password)

        post_data = [
            {
                "hotel_identifier": hotel_identifier,
                "language_name": "English",
                "currency": currency,
                "adults": adults,
            }
        ]

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/advanced/task_post",
                    json=post_data,
                )
                res_json = response.json()

                if res_json.get("status_code") == 20100 or (
                    res_json.get("status_code") == 20000 and res_json.get("tasks")
                ):
                    task = res_json["tasks"][0]
                    return {
                        "status": "pending",
                        "task_id": task.get("id"),
                        "message": "Hotel Information task submitted.",
                    }

                logger.warning(
                    f"DataForSEO Hotel Info POST failed: {res_json.get('status_message')}"
                )
                return None

        except Exception as e:
            logger.error(f"DataForSEO fetch_hotel_info error: {e}")
            return None

    # ===== Task API (Async) Implementation =====

    async def post_price_tasks(
        self, task_params: List[Dict[str, Any]], pingback_url: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
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
            if pingback_url:
                task["pingback_url"] = pingback_url
            modified_params.append(task)

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=modified_params,
                )
                res_json = response.json()

                if res_json.get("status_code") != 20000:
                    logger.error(
                        f"DataForSEO Task POST Failed: {res_json.get('status_message')}"
                    )
                    return None

                return res_json.get("tasks", [])
        except Exception as e:
            logger.error(f"DataForSEO post_price_tasks error: {e}")
            return None

    async def post_info_tasks(
        self, tasks: List[Dict[str, Any]], pingback_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Batch posts hotel metadata tasks to DataForSEO."""
        if not self.login or not self.password:
            return []
        auth = (self.login, self.password)
        if pingback_url:
            for t in tasks:
                t["pingback_url"] = pingback_url
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/task_post",
                    json=tasks,
                )
                if response.status_code != 200 or response.json().get(
                    "status_code"
                ) not in [20000, 20100]:
                    logger.error(
                        f"DataForSEO info POST error: {response.status_code} - {response.text}"
                    )
                res_json = response.json()
                return res_json.get("tasks", [])
        except Exception as e:
            logger.error(f"DataForSEO info POST exception: {e}")
            return []

    async def post_hotel_tokens(
        self, property_tokens: List[str], location_name: Optional[str] = "Turkiye"
    ) -> Optional[List[str]]:
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
                "language_name": "English",
            }
            for token in property_tokens
        ]

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/task_post",
                    json=tasks,
                )
                res_json = response.json()

                # DataForSEO returns 20100 for successful completion or submission
                if res_json.get("status_code") not in [20000, 20100]:
                    logger.error(
                        f"DataForSEO post_hotel_tokens Failed: {res_json.get('status_message')}"
                    )
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
        deep_scan: bool = False,
        pingback_url: Optional[str] = None,
    ) -> int:
        """
        High-level batch submission for the system heartbeat.
        If deep_scan=True, it submits both Pricing AND Metadata/Sentiment tasks.
        """
        if not hotel_ids:
            return 0

        # 1. Fetch hotel metadata for keywords
        try:
            hotels_res = (
                db.table("hotels")
                .select(
                    "id, name, location, property_token, serp_api_id, location_code, latitude, longitude"
                )
                .in_("id", hotel_ids)
                .execute()
            )

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
            location_code = hotel.get("location_code")

            # Price Task (Always submitted)
            price_uuid = str(uuid.uuid4())
            hotel_task_map[price_uuid] = hid

            # [KAIZEN 2026] Use hotel_identifier for targeted property pricing
            # This forces the API to return the specific hotel rather than searching for neighbors
            is_targeted = bool(hotel.get("serp_api_id") or hotel.get("property_token"))

            price_task = {
                "hotel_identifier": keyword if is_targeted else None,
                "keyword": None if is_targeted else keyword,
                "location_name": normalized_loc,
                "language_name": "English",
                "check_in": check_in,
                "check_out": check_out,
                "currency": "TRY",
                "tag": price_uuid,
            }
            if location_code:
                price_task["location_code"] = location_code
            if hotel.get("latitude") and hotel.get("longitude"):
                price_task["location_coordinate"] = (
                    f"{hotel['latitude']},{hotel['longitude']},50"
                )

            price_task_params.append(price_task)

            # Info Task (Only if deep_scan)
            if deep_scan:
                info_uuid = str(uuid.uuid4())
                hotel_task_map[info_uuid] = hid

                # Correct key for hotel_info is 'hotel_identifier', not 'keyword'
                # unless we are doing a keyword search, but with property_token it must be hotel_identifier.
                info_task = {
                    "hotel_identifier": keyword
                    if (hotel.get("serp_api_id") or hotel.get("property_token"))
                    else None,
                    "keyword": None
                    if (hotel.get("serp_api_id") or hotel.get("property_token"))
                    else keyword,
                    "location_name": normalized_loc,
                    "language_name": "English",
                    "check_in": check_in,
                    "check_out": check_out,
                    "currency": "TRY",
                    "tag": info_uuid,
                }
                if location_code:
                    info_task["location_code"] = location_code
                if hotel.get("latitude") and hotel.get("longitude"):
                    info_task["location_coordinate"] = (
                        f"{hotel['latitude']},{hotel['longitude']},50"
                    )

                info_task_params.append(info_task)

        CHUNK_SIZE = 100
        total_submitted = 0

        # Prices
        for i in range(0, len(price_task_params), CHUNK_SIZE):
            chunk = price_task_params[i : i + CHUNK_SIZE]
            res = await self.post_price_tasks(chunk, pingback_url=pingback_url)
            if res:
                total_submitted += await self._register_scan_tasks(
                    db, res, hotel_task_map, "price_search"
                )

        # Info
        if info_task_params:
            for i in range(0, len(info_task_params), CHUNK_SIZE):
                chunk = info_task_params[i : i + CHUNK_SIZE]
                res = await self.post_info_tasks(chunk, pingback_url=pingback_url)
                if res:
                    total_submitted += await self._register_scan_tasks(
                        db, res, hotel_task_map, "hotel_info"
                    )

        return total_submitted

    async def _register_scan_tasks(
        self,
        db: Client,
        tasks: List[Dict[str, Any]],
        mapping: Dict[str, str],
        task_type: str,
    ) -> int:
        """Helper to register external tasks into internal scan_tasks table."""
        try:
            batch_res = (
                db.table("scan_batches")
                .insert(
                    {
                        "total_count": len(tasks),
                        "status": "processing",
                        "batch_type": task_type,
                    }
                )
                .execute()
            )
            batch_id = batch_res.data[0]["id"] if batch_res.data else None

            scan_tasks = []
            for t in tasks:
                if t.get("status_code") == 20100:
                    req_data = t.get("data", {})
                    tag = req_data.get("tag")
                    if tag and tag in mapping:
                        scan_tasks.append(
                            {
                                "id": tag,
                                "external_task_id": t["id"],
                                "hotel_id": mapping[tag],
                                "batch_id": batch_id,
                                "status": "pending",
                                "task_type": task_type,
                            }
                        )

            if scan_tasks:
                db.table("scan_tasks").insert(scan_tasks).execute()
                return len(scan_tasks)
            return 0
        except Exception as e:
            logger.error(f"Failed to register scan tasks: {e}")
            return 0

    async def fetch_task_results(
        self,
        task_id: str,
        target_token: Optional[str] = None,
        target_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Retrieves results for price search tasks with identity matching."""
        return await self._fetch_results_generic(
            task_id,
            "hotel_searches",
            target_token=target_token,
            target_name=target_name,
        )

    async def fetch_hotel_info_results(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves results for rich metadata (hotel_info) tasks from either advanced or standard endpoint."""
        # Try advanced first
        raw = await self._fetch_results_generic(task_id, "hotel_info/advanced")
        if raw and raw.get("status") == "success" and raw.get("items"):
            return raw

        # Fallback to standard
        return await self._fetch_results_generic(task_id, "hotel_info")

    async def _fetch_results_generic(
        self,
        task_id: str,
        endpoint: str,
        target_token: Optional[str] = None,
        target_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Internal helper for GET results with Identity Verification logic."""
        if not self.login or not self.password or not task_id:
            return None

        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                # [FIX 2026-04-19] DataForSEO URL pattern:
                #   POST: hotel_info/task_post
                #   GET:  hotel_info/task_get/advanced/{id}
                # The method (advanced/html) goes AFTER task_get, not before it.
                # For hotel_searches, the pattern is: hotel_searches/task_get/{id}
                if "/" in endpoint:
                    # e.g. "hotel_info/advanced" → base="hotel_info", method="advanced"
                    base, method = endpoint.rsplit("/", 1)
                    url = f"{self.api_url}/business_data/google/{base}/task_get/{method}/{task_id}"
                else:
                    url = f"{self.api_url}/business_data/google/{endpoint}/task_get/{task_id}"

                response = await client.get(url)
                res_json = response.json()

                if res_json.get("status_code") != 20000:
                    return None

                tasks = res_json.get("tasks", [])
                if not tasks:
                    return None

                task = tasks[0]
                if not task.get("result"):
                    return {
                        "status": "success",
                        "items": [],
                        "tag": (task.get("data") or {}).get("tag"),
                        "task_type": "price_search"
                        if "hotel_searches" in endpoint
                        else "hotel_info",
                    }

                result = task["result"][0]
                items = result.get("items", [])

                if (
                    endpoint == "hotel_searches" or endpoint == "hotel_search"
                ) and items:
                    # [KAIZEN 2026] IDENTITY ENFORCEMENT
                    # We no longer take items[0]. We find the item that MATCHES our target.
                    target = None

                    if target_token:
                        # Priority 1: Exact Token Match
                        for item in items:
                            if item.get("hotel_identifier") == target_token:
                                target = item
                                break

                    if not target and target_name:
                        # Priority 2: Fuzzy Name Match
                        from difflib import SequenceMatcher

                        best_score = 0

                        # Normalize target name for comparison
                        norm_target = self._normalize_location(target_name).lower()

                        for item in items:
                            raw_title = item.get("title", "")
                            # Normalize title for robust comparison
                            norm_title = self._normalize_location(raw_title).lower()

                            score = SequenceMatcher(
                                None, norm_target, norm_title
                            ).ratio()

                            # Promotion: If one is a substring of the other and they are reasonably similar
                            is_substring = (
                                norm_target in norm_title or norm_title in norm_target
                            )

                            if (is_substring and score > 0.60) or score > 0.75:
                                if score > best_score:
                                    target = item
                                    best_score = score

                    # Fallback: If no identity context provided, take items[0] (backward compatibility)
                    if not target and not target_token and not target_name:
                        target = items[0]

                    if not target:
                        logger.warning(
                            f"DataForSEO: No match found for hotel (Token: {target_token}, Name: {target_name}) in {len(items)} results. Skipping to prevent leakage."
                        )
                        return None

                    prices_data = target.get("prices", {})
                    reviews_data = target.get("reviews", {})

                    # Room Types Extraction
                    room_types_raw = target.get("room_types", [])
                    normalized_rooms = [
                        self._normalize_room_name(rt) for rt in room_types_raw
                    ]

                    # OTA Parity / All Prices
                    raw_prices = prices_data.get("items", []) or []
                    PRIORITY_OTAS = [
                        "Booking.com",
                        "Expedia",
                        "Agoda",
                        "Hotels.com",
                        "Airbnb",
                        "Otelz.com",
                        "Jolly Tur",
                    ]

                    def ota_priority(item):
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
                    search_sentiment = target.get("reviews_breakdown", {}).get(
                        "sentiment", []
                    )

                    # [FIX 3] Only emit price if API actually returned one (not None/0)
                    raw_price = prices_data.get("price")
                    result_dict = {
                        "status": "success",
                        "task_type": "price_search",
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
                        "raw_data": target,
                        "items": items,
                    }
                    # Only include price if it's a real positive number
                    if raw_price and float(raw_price) > 0:
                        result_dict["price"] = float(raw_price)
                    return result_dict

                if "hotel_info" in endpoint:
                    # [FIX 2026-04-19] hotel_info/advanced has TWO response shapes:
                    # Shape A: result has 'items' array containing hotel objects (identity matching needed)
                    # Shape B: result itself IS the hotel data (about, reviews, prices at top level)
                    #          This happens when hotel_identifier is used. items may be empty or
                    #          contain room type objects, NOT hotel identity objects.

                    # Detect Shape B: result itself has rich data (about/reviews/prices)
                    has_direct_data = bool(
                        result.get("about")
                        or result.get("reviews")
                        or result.get("prices")
                        or result.get("title")
                    )

                    if has_direct_data:
                        # Shape B: Parse result directly — it IS the hotel data
                        logger.info(
                            f"DataForSEO hotel_info: Direct result shape detected (keys: {list(result.keys())[:8]})"
                        )
                        parsed = self._parse_advanced_hotel_info(result)
                    elif items:
                        # Shape A: items array contains hotel objects, need identity matching
                        # [KAIZEN 2026] IDENTITY ENFORCEMENT for Hotel Info
                        target = None
                        if target_token:
                            for item in items:
                                if item.get("hotel_identifier") == target_token:
                                    target = item
                                    break

                        if not target and target_name:
                            from difflib import SequenceMatcher

                            best_score = 0
                            norm_target = self._normalize_location(target_name).lower()
                            for item in items:
                                norm_title = self._normalize_location(
                                    item.get("title", "")
                                ).lower()
                                score = SequenceMatcher(
                                    None, norm_target, norm_title
                                ).ratio()

                                is_substring = (
                                    norm_target in norm_title
                                    or norm_title in norm_target
                                )
                                if (is_substring and score > 0.60) or score > 0.75:
                                    if score > best_score:
                                        target = item
                                        best_score = score

                        if not target and not target_token and not target_name:
                            target = items[0]

                        if not target:
                            logger.warning(
                                f"DataForSEO: No match found for hotel (Token: {target_token}, Name: {target_name}) in {len(items)} info results. Blocking metadata update."
                            )
                            return None

                        # Try the item first; if it doesn't have hotel_info, use the result object.
                        if (
                            target.get("hotel_info")
                            or target.get("about")
                            or target.get("reviews")
                        ):
                            parsed = self._parse_advanced_hotel_info(target)
                        else:
                            parsed = self._parse_advanced_hotel_info(result)
                    else:
                        # No items and no direct data — empty result
                        logger.warning(
                            "DataForSEO hotel_info: Empty result (no items, no direct data)"
                        )
                        return {
                            "status": "success",
                            "items": [],
                            "task_type": "hotel_info",
                            "tag": (task.get("data") or {}).get("tag"),
                        }

                    # [FIX 3] hotel_info results must NOT include price field
                    # This prevents the merge logic from overwriting valid prices with 0
                    info_result = {
                        "status": "success",
                        "task_type": "hotel_info",
                        "tag": (task.get("data") or {}).get("tag"),
                        **parsed,
                    }
                    # Remove any price/best_price that defaulted to None/0
                    # hotel_info should NEVER set pricing — that's price_search's job
                    info_result.pop("price", None)
                    info_result.pop("best_price", None)
                    return info_result

                return {
                    "status": "success",
                    "items": items,
                    "tag": (task.get("data") or {}).get("tag"),
                }
        except Exception as e:
            logger.error(f"DataForSEO GET error ({endpoint}): {e}")
            return None

    async def get_task_result(
        self,
        task_id: str,
        target_token: Optional[str] = None,
        target_name: Optional[str] = None,
        task_type: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Implementation of abstract method from HotelDataProvider.

        [FIX 1] Task-type-aware routing: uses task_type from scan_tasks table
        to call the correct endpoint directly, instead of brute-forcing all three.
        This eliminates wasted API calls and prevents cross-endpoint data contamination.
        """
        if task_type == "hotel_info":
            # [FIX 2026-04-19] Tasks are posted to hotel_info/task_post.
            # Results are fetched from hotel_info/task_get/advanced/{id}.
            # The "advanced" method gets structured data; no separate "advanced" post endpoint.
            res = await self._fetch_results_generic(
                task_id,
                "hotel_info/advanced",
                target_token=target_token,
                target_name=target_name,
            )
            return res if res and res.get("status") == "success" else None
        else:
            # Default: price_search via hotel_searches
            res = await self.fetch_task_results(
                task_id, target_token=target_token, target_name=target_name
            )
            return res if res and res.get("status") == "success" else None

    async def get_completed_tasks(self) -> List[str]:
        """Returns a list of Task IDs that are ready for retrieval across all endpoints."""
        tasks = await asyncio.gather(
            self._get_ready_tasks_generic("hotel_searches"),
            self._get_ready_tasks_generic("hotel_info"),
            # [FIX 2026-04-19] Removed "hotel_info/advanced" — it's NOT a separate
            # tasks_ready endpoint. All hotel_info tasks appear in hotel_info/tasks_ready.
            # The "advanced" part is only the GET method: hotel_info/task_get/advanced/{id}
            return_exceptions=True,
        )

        all_ids = []
        for res in tasks:
            if isinstance(res, list):
                all_ids.extend(res)
        return all_ids

    async def _get_ready_tasks_generic(self, endpoint: str) -> List[str]:
        """Internal helper for pooling ready tasks."""
        if not self.login or not self.password:
            return []
        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
                response = await client.get(
                    f"{self.api_url}/business_data/google/{endpoint}/tasks_ready"
                )
                res_json = response.json()
                if res_json.get("status_code") == 20000:
                    return [
                        t.get("id") for t in res_json.get("tasks", []) if t.get("id")
                    ]
                return []
        except Exception as e:
            logger.error(f"DataForSEO ready tasks error ({endpoint}): {e}")
            return []


# Global instance for service usage
dataforseo_provider = DataForSEOProvider()
