import asyncio
import os
import re
import unicodedata
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.services.data_provider_interface import HotelDataProvider

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

    def _normalize_location(self, location: Optional[str]) -> str:
        """
        Normalizes location for DataForSEO API.

        This method performs four critical transformations:
        1. Explicitly handles 'İ' (Turkish dotted I) before lowercasing.
        2. Transliterates Turkish-specific characters (ı, ğ, ü, ş, ö, ç) to ASCII.
        3. Normalizes non-spacing marks (accents).
        4. Maps common country variations (e.g., Turkey -> Turkiye) to API-supported names.
        5. Removes trailing/leading spaces from comma-separated location parts.

        Args:
            location: The raw location string (e.g., "İstanbul, Türkiye")
        Returns:
            A sanitized string ready for the 'location_name' API field.
        """
        if not location:
            return ""

        # 1. Handle 'İ' specifically before any processing
        # In Turkish, İ.lower() is 'i', but in some environments it might fail or behave unexpectedly.
        # We ensure it becomes 'I' (ASCII 73) or 'i' (ASCII 105) consistently.
        loc = location.replace("İ", "I").replace("ı", "i")

        # 2. Transliterate other Turkish characters
        loc = loc.translate(_TURKISH_CHAR_MAP)

        # 3. General ASCII normalization (remove accents)
        loc = "".join(
            c
            for c in unicodedata.normalize("NFD", loc)
            if unicodedata.category(c) != "Mn"
        )

        # 4. Handle Country Aliases
        for variant, official in _COUNTRY_NAME_MAP.items():
            if variant in loc.lower():
                loc = re.sub(re.escape(variant), official, loc, flags=re.IGNORECASE)

        # 5. Remove spaces after commas
        loc = ",".join([s.strip() for s in loc.split(",")])

        return loc

    async def _vault_log(
        self, db: Any, session_id: str, endpoint: str, data: Any
    ) -> None:
        """Internal helper to log raw payload to the Everything Vault."""
        if not db or not session_id:
            return

        try:
            import json
            # Capture metadata alongside raw data
            vault_item = {
                "endpoint": endpoint,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": data,
            }

            db.table("vault.secrets").insert(
                {
                    "name": f"dataforseo_{session_id}_{uuid.uuid4().hex[:8]}",
                    "secret": json.dumps(vault_item),
                    "description": f"Raw DataForSEO response for {endpoint}",
                }
            ).execute()
        except Exception as vault_err:
            logger.error(
                f"Everything Vault Failure for session {session_id}: {vault_err}"
            )

    def _normalize_room_name(self, name: Any) -> Dict[str, Any]:
        """
        Cleans room names and extracts metadata attributes using RoomTypeNormalizer.
        Returns a dict: {'name': cleaned_name, 'attributes': {...}, 'is_vendor': bool}
        """
        from backend.utils.room_normalizer import RoomTypeNormalizer

        if not name:
            return {"name": "Standard Room", "attributes": {}, "is_vendor": False}

        name_str = str(name)
        original_input = name_str
        normalized_data = RoomTypeNormalizer.normalize(name_str)
        
        # === Attribute Extraction ===
        original_lower = name_str.lower()
        attributes = {
            "is_refundable": True,
            "has_breakfast": False,
            "has_wifi": True,  # Usually standard now
            "bed_type": None,
        }

        # Check for non-refundable
        if any(x in original_lower for x in ["non-refundable", "non refundable", "n/r", "iptal edilemez"]):
            attributes["is_refundable"] = False

        # Check for breakfast
        if any(
            x in original_lower
            for x in ["breakfast", "kahvalti", "bb", "half board", "full board", "yarim pansiyon", "tam pansiyon"]
        ):
            attributes["has_breakfast"] = True

        return {
            "name": original_input,  # Actual roomtype name
            "canonical_name": normalized_data["canonical_name"],
            "attributes": attributes,
            "is_vendor": normalized_data["is_vendor"]
        }

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
        # AGENT_FIX: Ensure environment is loaded before reading variables.
        # This prevents issues where this module is imported before db.py triggers load_dotenv.
        from backend.utils.db import load_env_standard
        load_env_standard()
        
        self.login = os.getenv("DATAFORSEO_LOGIN")
        self.password = os.getenv("DATAFORSEO_PASSWORD")
        self.postback_url = os.getenv("DATAFORSEO_POSTBACK_URL")
        
        # Fallback to general APP_URL if set
        if not self.postback_url:
            app_url = os.getenv("APP_URL")
            if app_url:
                self.postback_url = f"{app_url}/api/v1/webhooks/dataforseo"
        
        self.api_url = "https://api.dataforseo.com/v3"

        if not self.login or not self.password:
            logger.warning("DataForSEO credentials missing from environment.")

        if self.postback_url:
            logger.info(f"DataForSEO Webhooks ENABLED with postback: {self.postback_url}")
        else:
            logger.warning("DataForSEO Webhooks DISABLED (DATAFORSEO_POSTBACK_URL not set).")

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

    async def check_health(self) -> Dict[str, Any]:
        """
        Check if the provider is healthy (credentials valid, API reachable).
        Calls the DataForSEO user info endpoint.
        """
        if not self.login or not self.password:
            return {
                "status": "unhealthy",
                "reason": "Credentials missing",
                "details": {}
            }

        auth = (self.login, self.password)
        try:
            async with httpx.AsyncClient(auth=auth, timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/user")
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status_code") == 20000:
                        user_data = data.get("tasks", [{}])[0].get("result", [{}])[0]
                        return {
                            "status": "healthy",
                            "details": {
                                "login": user_data.get("login"),
                                "balance": user_data.get("money_limit"),
                                "spent": user_data.get("money_spent"),
                            }
                        }
                    return {
                        "status": "unhealthy",
                        "reason": f"API Error: {data.get('status_message')}",
                        "details": data
                    }

                return {
                    "status": "unhealthy",
                    "reason": f"HTTP Error {response.status_code}",
                    "details": {"text": response.text}
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "reason": str(e),
                "details": {}
            }

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
        # Merge items from prices object and top-level items array
        raw_price_items = (prices_obj.get("items") or []) + (data.get("items") or [])
        
        seen_items = set()
        for pi in raw_price_items:
            if isinstance(pi, dict) and (pi.get("type") == "hotel_info_price" or pi.get("price")):
                # [FIX] Prioritize source/vendor over title for the OTA name
                source = pi.get("source") or pi.get("vendor") or pi.get("title")
                if not source:
                    continue
                
                # Extract sub-offers if present (this holds individual room types and rates for this OTA)
                sub_offers = pi.get("offers") or []
                if isinstance(sub_offers, list) and len(sub_offers) > 0:
                    for sub_off in sub_offers:
                        if not isinstance(sub_off, dict):
                            continue
                        
                        # Get price and room title from the sub-offer
                        sub_price = sub_off.get("price")
                        sub_room = sub_off.get("title")
                        sub_curr = sub_off.get("currency") or pi.get("currency")
                        sub_url = sub_off.get("url") or pi.get("source_url") or pi.get("url")
                        
                        if sub_price is None:
                            continue
                            
                        # [FIX] Deduplicate by (source, room, price) to avoid losing different room types with same price
                        dedup_key = f"{source}_{sub_room}_{sub_price}"
                        if dedup_key in seen_items:
                            continue
                        seen_items.add(dedup_key)
                        
                        ota_prices.append(
                            {
                                "source": source,
                                "room_type": sub_room,
                                "price": sub_price,
                                "currency": sub_curr,
                                "url": sub_url,
                                "type": sub_off.get("type", "hotel_info_price_offer"),
                                "official_site": pi.get("official_site", False),
                                "free_cancellation_until": sub_off.get("free_cancellation_until") or pi.get("free_cancellation_until"),
                                "max_visitors": sub_off.get("max_visitors"),
                            }
                        )
                else:
                    # Fallback to top-level OTA item if no sub-offers
                    room_title = pi.get("title") if pi.get("source") or pi.get("vendor") else None
                    price_val = pi.get("price")
                    
                    dedup_key = f"{source}_{room_title}_{price_val}"
                    if dedup_key in seen_items:
                        continue
                    seen_items.add(dedup_key)
                    
                    ota_prices.append(
                        {
                            "source": source,
                            "room_type": room_title,
                            "price": price_val,
                            "currency": pi.get("currency"),
                            "url": pi.get("source_url") or pi.get("url"),
                            "type": pi.get("type", "hotel_info_price"),
                            "official_site": pi.get("official_site", False),
                            "free_cancellation_until": pi.get("free_cancellation_until"),
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
                room_title = item.get("title")
                normalized = self._normalize_room_name(room_title)
                
                if normalized.get("is_vendor"):
                    continue
                    
                img = None
                if item.get("images"):
                    img = item["images"][0]
                room_catalog.append(
                    {
                        "name": normalized.get("name") or room_title,
                        "price": item.get("price_raw") or item.get("price"),
                        "currency": item.get("currency"),
                        "source": item.get("source"),
                        "url": item.get("url"),
                        "capacity": item.get("capacity"),
                        "features": item.get("features"),
                        "image_url": img,
                    }
                )

        # Fallback to about.rooms if room_catalog is empty (Deep Scans)
        if not room_catalog and about.get("rooms"):
            for r in about["rooms"]:
                if isinstance(r, dict):
                    room_title = r.get("title") or r.get("name")
                    normalized = self._normalize_room_name(room_title)
                    
                    if normalized.get("is_vendor"):
                        continue
                        
                    room_catalog.append({
                        "name": normalized.get("name") or room_title,
                        "price": None,
                        "currency": None,
                        "source": "About",
                        "url": None,
                        "capacity": None,
                        "features": None,
                        "image_url": r.get("image_url") or r.get("image"),
                    })

        # Fallback 2: Extract unique room types from ota_prices if room_catalog is still empty
        if not room_catalog and ota_prices:
            seen_derived_rooms = set()
            for op in ota_prices:
                if isinstance(op, dict) and op.get("room_type"):
                    r_title = op.get("room_type")
                    normalized = self._normalize_room_name(r_title)
                    if normalized.get("is_vendor"):
                        continue
                    
                    final_name = normalized.get("name") or r_title
                    if final_name and final_name not in seen_derived_rooms:
                        seen_derived_rooms.add(final_name)
                        room_catalog.append({
                            "name": final_name,
                            "price": op.get("price"),
                            "currency": op.get("currency"),
                            "source": f"{op.get('source', 'OTA')} (Derived)",
                            "url": op.get("url"),
                            "capacity": op.get("max_visitors"),
                            "features": None,
                            "image_url": None,
                        })

        # === 9. Best Price from prices object ===
        best_price = prices_obj.get("price")
        currency = prices_obj.get("currency")

        # Currency Fallback: check room catalog or items
        if not currency:
            for r in room_catalog:
                if r.get("currency"):
                    currency = r["currency"]
                    break
        if not currency and items:
            for item in items:
                if isinstance(item, dict) and item.get("currency"):
                    currency = item["currency"]
                    break

        logger.info(
            f"DataForSEO AdvancedParser: title={title}, stars={stars}, rating={rating}, "
            f"reviews={reviews_count}, amenities={len(amenities)}, "
            f"ota_prices={len(ota_prices)}, mentions={len(sentiment_breakdown)}, "
            f"rooms={len(room_catalog)}, images={len(hotel_images)}, "
            f"other_site_reviews={len(other_sites_reviews)}"
        )

        # === 10. Extract Individual Review Snippets ===
        # [FIX 2026-04-30] DataForSEO hotel_info returns review text inside
        # other_sites_reviews[].review_text. We extract these into a flat
        # "reviews_list" array so scan_persistence can persist to hotel_reviews.
        reviews_list = []
        for osr in other_sites_reviews:
            if isinstance(osr, dict) and osr.get("review_text"):
                # Split multi-review blocks (pipe-delimited by DataForSEO)
                texts = osr["review_text"].split("|")
                for text in texts:
                    text = text.strip()
                    if not text:
                        continue
                    osr_rating = osr.get("rating", {})
                    reviews_list.append({
                        "author": osr.get("title", "Anonymous"),  # source name as author
                        "rating": osr_rating.get("value") if isinstance(osr_rating, dict) else osr_rating,
                        "text": text,
                        "source": osr.get("title"),
                        "url": osr.get("url"),
                    })

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
            "reviews_list": reviews_list,      # [FIX] Flat list of review text for hotel_reviews table
            "ota_prices": ota_prices,
            "all_prices": ota_prices,      # [FIX] Return all_prices for consistency
            "parity_offers": ota_prices,   # [FIX] Return parity_offers for consistency
            "offers": ota_prices,          # [FIX] Return offers for consistency
            "room_catalog": room_catalog,
            "room_types": [r["name"] for r in room_catalog if r.get("name")],
            "price": best_price,           # [FIX] Standardize price key
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
        check_in: Optional[str] = None,
        check_out: Optional[str] = None,
        adults: int = 2,
        currency: Optional[str] = None,
        session_id: Optional[str] = None,
        db: Optional[Any] = None,
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

            if db and session_id and response:
                await self._vault_log(
                    db, session_id, "business_data/google/hotel_info/advanced/live", response
                )

            if response and response.get("tasks"):
                task = response["tasks"][0]
                if task.get("result"):
                    result = task["result"][0]
                    return self._parse_advanced_hotel_info(result)

            return {"status": "error", "message": "No data returned from Advanced API"}

        except Exception as e:
            logger.error(f"Advanced scan failed: {e}")
            return {"status": "error", "message": f"Advanced scan failed: {e}"}
    async def search_hotels(
        self,
        query: str,
        limit: int = 10,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Implementation of HotelDataProvider.search_hotels using DataForSEO.
        Uses the 'hotel_searches' endpoint to find hotels in a location.
        """
        if not self.login or not self.password:
            return []

        auth = (self.login, self.password)
        post_data = [
            {
                "location_name": self._normalize_location(query),
                "language_code": "en",
                "limit": limit,
            }
        ]
        
        if self.postback_url:
            post_data[0]["postback_url"] = self.postback_url

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=post_data,
                )
                res_json = response.json()

                if db and session_id:
                    await self._vault_log(
                        db, session_id, "google/hotel_searches/task_post", res_json
                    )

                if res_json.get("status_code") not in [20000, 20100]:
                    logger.error(f"Search Hotels Post Failed: {res_json.get('status_message')}")
                    return []

                tasks = res_json.get("tasks", [])
                # Usually we'd return a list of simplified hotel objects if sync,
                # but since it's async task_post, we return the task metadata wrapped as 'results'
                # or just the task list. The interface expects List[Dict].
                return tasks
        except Exception as e:
            logger.error(f"search_hotels failed: {e}")
            return []

    async def fetch_price(
        self,
        hotel_name: str,
        location: str,
        check_in: date,
        check_out: date,
        adults: int = 2,
        currency: Optional[str] = None,
        serp_api_id: Optional[str] = None,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Implementation of HotelDataProvider.fetch_price using DataForSEO Live Search.
        Captures best price and all market offers (OTA prices).
        """
        if not self.login or not self.password:
            return {"status": "error", "error": "missing_credentials"}, None

        auth = (self.login, self.password)

        try:
            # Prepare task payload for DataForSEO.
            # We use the 'keyword' based approach which is most reliable for specific hotels.
            post_data = [
                {
                    "location_name": self._normalize_location(location),
                    "language_code": "en",
                    "keyword": hotel_name,
                    "check_in": check_in.strftime("%Y-%m-%d") if hasattr(check_in, "strftime") else check_in,
                    "check_out": check_out.strftime("%Y-%m-%d") if hasattr(check_out, "strftime") else check_out,
                    "currency": currency,
                    "adults": adults,
                    "limit": 1,
                }
            ]

            if self.postback_url:
                post_data[0]["postback_url"] = self.postback_url

            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=post_data,
                )
                res_json = response.json()

                if db and session_id:
                    await self._vault_log(
                        db, session_id, "google/hotel_searches/task_post", res_json
                    )

                if res_json.get("status_code") != 20100 and res_json.get("status_code") != 20000:
                    logger.error(
                        f"DataForSEO Task POST Failed: {res_json.get('status_message')}"
                    )
                    return {
                        "status": "error",
                        "error": f"{res_json.get('status_message')}",
                    }, res_json

                task = res_json.get("tasks", [{}])[0]
                return {
                    "status": "pending",
                    "task_id": task.get("id"),
                    "message": "Task submitted to standard queue. Poll fetch_task_results later.",
                }, res_json
        except Exception as e:
            logger.error(f"DataForSEO Provider fetch_price Error: {e}")
            return {"status": "error", "error": str(e)}, None

    async def fetch_hotel_info(
        self,
        hotel_id: str,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
        currency: Optional[str] = None,
        adults: int = 1,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Submits a task to the DataForSEO Google Hotels Info endpoint.
        Standard method: POST task, then GET results later.
        """
        if not self.login or not self.password or not hotel_id:
            return {
                "status": "failed",
                "failure_reason": "invalid_request",
                "message": "Missing credentials or hotel_id"
            }, None

        auth = (self.login, self.password)

        post_data = [
            {
                "hotel_identifier": hotel_id,
                "language_name": "English",
                "currency": currency,
                "adults": adults,
            }
        ]

        if self.postback_url:
            post_data[0]["postback_url"] = self.postback_url

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_info/task_post",
                    json=post_data,
                )
                res_json = response.json()

                if db and session_id:
                    await self._vault_log(
                        db, session_id, "business_data/google/hotel_info/advanced/task_post", res_json
                    )

                if res_json.get("status_code") == 20100 or (
                    res_json.get("status_code") == 20000 and res_json.get("tasks")
                ):
                    task = res_json["tasks"][0]
                    return {
                        "status": "pending",
                        "task_id": task.get("id"),
                        "message": "Hotel Information task submitted.",
                    }, res_json

                return {
                    "status": "failed",
                    "failure_reason": "provider_error",
                    "message": res_json.get("status_message", "Task submission failed")
                }, res_json

        except Exception as e:
            logger.error(f"DataForSEO fetch_hotel_info error: {e}")
            return {
                "status": "failed",
                "failure_reason": "exception",
                "message": str(e)
            }, None

    # ===== Task API (Async) Implementation =====

    async def post_price_tasks(
        self, task_params: List[Dict[str, Any]], pingback_url: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Submits multiple hotel search tasks to DataForSEO."""
        if not self.login or not self.password or not task_params:
            logger.error(
                f"post_price_tasks: PRE-FLIGHT ABORT — "
                f"login={'SET' if self.login else 'MISSING'}, "
                f"password={'SET' if self.password else 'MISSING'}, "
                f"task_params_count={len(task_params) if task_params else 0}"
            )
            return None

        auth = (self.login, self.password)
        logger.info(f"post_price_tasks: Submitting {len(task_params)} tasks to DataForSEO...")

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
            if self.postback_url:
                task["postback_url"] = self.postback_url
            modified_params.append(task)

        try:
            async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/business_data/google/hotel_searches/task_post",
                    json=modified_params,
                )
                res_json = response.json()

                api_status = res_json.get("status_code")
                logger.info(
                    f"post_price_tasks: API response status={api_status}, "
                    f"message='{res_json.get('status_message')}', "
                    f"tasks_returned={len(res_json.get('tasks', []))}"
                )

                if api_status not in [20000, 20100]:
                    logger.error(
                        f"DataForSEO Task POST Failed: {res_json.get('status_message')}"
                    )
                    return None

                return res_json.get("tasks", [])
        except Exception as e:
            logger.error(f"DataForSEO post_price_tasks error: {e}", exc_info=True)
            return None

    async def post_info_tasks(
        self, tasks: List[Dict[str, Any]], pingback_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Batch posts hotel metadata tasks to DataForSEO."""
        if not self.login or not self.password:
            return []
        auth = (self.login, self.password)
        # [2026-05-04] hotel_info task_post does NOT support postback/pingback URLs.
        # Sending them causes 'Invalid Field: postback_data' rejection.
        # We must poll for these results instead.
        pass
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

        if self.postback_url:
            for t in tasks:
                t["postback_url"] = self.postback_url

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
        hotels: List[Dict[str, Any]],
        check_in: str,
        check_out: str,
        deep_scan: bool = False,
        pingback_url: Optional[str] = None,
        session_id: Optional[str] = None,
        currency: Optional[str] = None,
        adults: Optional[int] = None,
        children: Optional[List[int]] = None,
    ) -> int:
        """
        Submits a batch of hotels for discovery.
        Returns the number of tasks successfully registered.
        If deep_scan=True, it submits both Pricing AND Metadata/Sentiment tasks.
        """
        logger.info(
            f"submit_hotel_scan_batch: ENTRY — "
            f"hotels={len(hotels)}, session={session_id}, "
            f"check_in={check_in}, check_out={check_out}, "
            f"deep_scan={deep_scan}, currency={currency}"
        )
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

            # Respect hotel-specific currency if set, else use batch default
            hotel_currency = hotel.get("currency") or currency

            # [KAIZEN 2026] FIX: DataForSEO hotel_searches requires 'keyword'. 
            # Even if we have a token, we MUST send the keyword to narrow the search.
            # Otherwise, it does a broad city search and might miss our hotel if it's not in top 10.
            price_task = {
                "hotel_identifier": hotel.get("property_token") or hotel.get("serp_api_id"),
                "keyword": f"{hotel['name']} {hotel['location']}",
                "location_name": normalized_loc,
                "language_name": "English",
                "check_in": check_in,
                "check_out": check_out,
                "currency": hotel_currency,
                "tag": price_uuid,
            }

            # [2026-05-04] Support custom occupancy
            # Priority: explicit arg > hotel scan setting
            task_adults = adults or hotel.get("scan_adults")
            task_children = children or hotel.get("scan_children_ages")

            if task_adults:
                price_task["adults"] = task_adults
            if task_children:
                price_task["children"] = task_children
            if location_code:
                price_task["location_code"] = location_code
            if hotel.get("latitude") and hotel.get("longitude"):
                price_task["location_coordinate"] = (
                    f"{hotel['latitude']},{hotel['longitude']},50"
                )

            price_task_params.append(price_task)

            # Info Task — ALWAYS submitted alongside price_search.
            # [FIX 2026-05-11] The hotel_searches endpoint only returns aggregate 
            # pricing (prices.items: null). The full OTA breakdown (per-source prices,
            # room types, offers from Booking.com/Expedia/Agoda/etc.) is ONLY available
            # from the hotel_info/advanced endpoint. Previously gated behind deep_scan,
            # which meant normal heartbeat scans had zero OTA parity data.
            info_uuid = str(uuid.uuid4())
            hotel_task_map[info_uuid] = hid

            # Correct key for hotel_info is 'hotel_identifier', not 'keyword'
            # unless we are doing a keyword search, but with property_token it must be hotel_identifier.
            # [FIX 2026-05-12] API DOES support dates/occupancy with hotel_identifier, 
            # provided location_name and language_name/code are also supplied. 
            # Restoring these allows rich OTA breakdown to line up with desired booking window.
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
                "currency": currency,
                "adults": adults,
                "tag": info_uuid,
            }
            if task_children:
                info_task["children"] = task_children
            
            # Priority and other standard fields are okay, but not search-specific ones.
            if location_code:
                info_task["location_code"] = location_code

            info_task_params.append(info_task)

        CHUNK_SIZE = 100
        total_submitted = 0

        logger.info(
            f"submit_hotel_scan_batch: Built {len(price_task_params)} price tasks, "
            f"{len(info_task_params)} info tasks for session {session_id}"
        )

        # Prices
        for i in range(0, len(price_task_params), CHUNK_SIZE):
            chunk = price_task_params[i : i + CHUNK_SIZE]
            res = await self.post_price_tasks(chunk, pingback_url=pingback_url)
            if res:
                registered = await self._register_scan_tasks(
                    db, res, hotel_task_map, "price_search", session_id=session_id
                )
                logger.info(
                    f"submit_hotel_scan_batch: Price chunk {i//CHUNK_SIZE + 1} — "
                    f"API returned {len(res)} tasks, registered {registered} in DB"
                )
                total_submitted += registered
            else:
                logger.error(
                    f"submit_hotel_scan_batch: Price chunk {i//CHUNK_SIZE + 1} — "
                    f"post_price_tasks returned None/empty for {len(chunk)} tasks!"
                )

        # Info
        if info_task_params:
            for i in range(0, len(info_task_params), CHUNK_SIZE):
                chunk = info_task_params[i : i + CHUNK_SIZE]
                res = await self.post_info_tasks(chunk, pingback_url=pingback_url)
                if res:
                    registered = await self._register_scan_tasks(
                        db, res, hotel_task_map, "hotel_info", session_id=session_id
                    )
                    logger.info(
                        f"submit_hotel_scan_batch: Info chunk {i//CHUNK_SIZE + 1} — "
                        f"API returned {len(res)} tasks, registered {registered} in DB"
                    )
                    total_submitted += registered
                else:
                    logger.error(
                        f"submit_hotel_scan_batch: Info chunk {i//CHUNK_SIZE + 1} — "
                        f"post_info_tasks returned None/empty for {len(chunk)} tasks!"
                    )

        logger.info(f"submit_hotel_scan_batch: EXIT — total_submitted={total_submitted}")
        return total_submitted

    async def _register_scan_tasks(
        self,
        db: Client,
        tasks: List[Dict[str, Any]],
        mapping: Dict[str, str],
        task_type: str,
        session_id: Optional[str] = None,
    ) -> int:
        """Helper to register external tasks into internal scan_tasks table."""
        try:
            batch_data = {
                "total_count": len(tasks),
                "status": "processing",
                "batch_type": task_type,
            }
            if session_id:
                batch_data["session_id"] = session_id

            batch_res = (
                db.table("scan_batches")
                .insert(batch_data)
                .execute()
            )
            batch_id = batch_res.data[0]["id"] if getattr(batch_res, "data", None) else None  # type: ignore
            logger.info(f"_register_scan_tasks: Created batch {batch_id} for {len(tasks)} tasks")

            scan_tasks = []
            unmatched_tags = 0
            no_tag_tasks = 0
            bad_status_tasks = 0
            for t in tasks:
                if t.get("status_code") in [20000, 20100]:
                    req_data = t.get("data", {})
                    tag = req_data.get("tag")
                    if not tag:
                        no_tag_tasks += 1
                        continue
                    if tag not in mapping:
                        unmatched_tags += 1
                        continue
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
                else:
                    bad_status_tasks += 1
                    logger.warning(
                        f"_register_scan_tasks: Task {t.get('id')} rejected — "
                        f"status={t.get('status_code')}, msg={t.get('status_message')}"
                    )

            if unmatched_tags or no_tag_tasks or bad_status_tasks:
                logger.warning(
                    f"_register_scan_tasks: Skipped tasks — "
                    f"no_tag={no_tag_tasks}, unmatched_tag={unmatched_tags}, "
                    f"bad_status={bad_status_tasks}"
                )

            if scan_tasks:
                db.table("scan_tasks").insert(scan_tasks).execute()
                logger.info(f"_register_scan_tasks: Inserted {len(scan_tasks)} scan_tasks into DB")
                return len(scan_tasks)

            logger.warning(f"_register_scan_tasks: No valid tasks to insert for batch {batch_id}")
            return 0
        except Exception as e:
            logger.error(f"Failed to register scan tasks: {e}", exc_info=True)
            return 0

    async def fetch_task_results(
        self,
        task_id: str,
        target_token: Optional[str] = None,
        target_name: Optional[str] = None,
        session_id: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """Retrieves results for price search tasks with identity matching."""
        processed, raw = await self._fetch_results_generic(
            task_id,
            "hotel_searches",
            target_token=target_token,
            target_name=target_name,
            db=db
        )

        if db and session_id and raw:
            await self._vault_log(db, session_id, "hotel_searches/task_get", raw)

        return processed, raw

    async def fetch_hotel_info_results(
        self,
        task_id: str,
        session_id: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """Retrieves results for rich metadata (hotel_info) tasks from either advanced or standard endpoint."""
        # Try advanced first
        processed, raw = await self._fetch_results_generic(task_id, "hotel_info/advanced")

        if db and session_id and raw:
            await self._vault_log(db, session_id, "hotel_info/task_get/advanced", raw)

        if processed and processed.get("status") == "success":
            # [FIX 2026-05-04] hotel_info/advanced uses Shape B (direct result data),
            # NOT Shape A (items array). Checking for "items" always failed, causing
            # unnecessary fallback calls to the standard endpoint.
            return processed, raw

        # Fallback to standard (only if advanced truly failed/pending)
        processed_std, raw_std = await self._fetch_results_generic(task_id, "hotel_info")

        if db and session_id and raw_std:
            await self._vault_log(db, session_id, "hotel_info/task_get", raw_std)

        return processed_std, raw_std

    async def _fetch_results_generic(
        self,
        task_id: str,
        endpoint: str,
        target_token: Optional[str] = None,
        target_name: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """Internal helper for GET results with Identity Verification logic."""
        if not self.login or not self.password or not task_id:
            return {
                "status": "failed",
                "failure_reason": "invalid_request",
                "message": "Missing credentials or task_id"
            }, None

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

                s_code = res_json.get("status_code")
                s_msg = res_json.get("status_message", "")
                
                if s_code != 20000:
                    # [FIX 2026-05-06] Handle "Task Handed" (40601) and "Not Found" (40401/40406) at response level
                    # DataForSEO sometimes returns these as the main status_code for GET requests.
                    if s_code in [40601, 40602, 40100] or any(word in s_msg for word in ["Handed", "Accepted", "Queued"]):
                         return {
                            "status": "pending",
                            "failure_reason": "not_ready",
                            "message": f"Task not ready: {s_msg} ({s_code})",
                            "status_code": s_code,
                            "tag": res_json.get("tasks", [{}])[0].get("data", {}).get("tag") if res_json.get("tasks") else None
                        }, res_json
                    
                    # Also handle "Not Found" as a temporary pending state (might be replication lag)
                    if s_code in [40401, 40406] or "Not Found" in s_msg:
                         return {
                            "status": "pending",
                            "failure_reason": "not_ready",
                            "message": f"Task not indexed yet: {s_msg} ({s_code})",
                            "status_code": s_code,
                            "tag": res_json.get("tasks", [{}])[0].get("data", {}).get("tag") if res_json.get("tasks") else None
                        }, res_json

                    return {
                        "status": "failed",
                        "failure_reason": "provider_error",
                        "message": s_msg or "DataForSEO API error",
                        "status_code": s_code,
                        "tag": res_json.get("tasks", [{}])[0].get("data", {}).get("tag") if res_json.get("tasks") else None
                    }, res_json

                tasks = res_json.get("tasks", [])
                if not tasks:
                    return {
                        "status": "failed",
                        "failure_reason": "invalid_response",
                        "message": "DataForSEO returned no tasks in response.",
                        "tag": None
                    }, res_json

                task = tasks[0]
                if not task.get("result"):
                    # If task is still pending or has no result, we return a success with empty items
                    # so that monitor_service treats it as "not ready" instead of a failure.
                    # [KAIZEN 2026] However, if status_code is failed, we should report it.
                    t_status = task.get("status_code")
                    t_msg = task.get("status_message", "") or ""
                    # [FIX 2026-05-06] Handle "Not Found" (40401) as pending at the task level too
                    # This handles cases where the task exists but isn't ready for retrieval yet.
                    if t_status in [40100, 40601, 40602, 40401, 40406] or any(word in t_msg for word in ["Handed", "Accepted", "Queued", "Not Found"]):
                        return {
                            "status": "pending",
                            "failure_reason": "not_ready",
                            "message": f"Task state: {t_msg or 'Processing'} (Code: {t_status})",
                            "status_code": t_status,
                            "tag": task.get("data", {}).get("tag")
                        }, res_json

                    if t_status and t_status != 10000 and t_status != 20000:
                         return {
                            "status": "failed",
                            "failure_reason": "task_error",
                            "message": t_msg or "Task failed internally",
                            "status_code": t_status,
                            "tag": (task.get("data") or {}).get("tag")
                        }, res_json

                    return {
                        "status": "success",
                        "items": [],
                        "tag": (task.get("data") or {}).get("tag"),
                        "task_type": "price_search"
                        if "hotel_searches" in endpoint
                        else "hotel_info",
                    }, res_json

                result = task["result"][0]
                items = result.get("items", [])
                tag = task.get("data", {}).get("tag")

                # [KAIZEN 2026] AUTO-RESOLVE IDENTITY FROM DB
                if not target_token and not target_name and db and tag:
                    try:
                        # Resolve scan_task_id from tag
                        scan_task_id = tag.split("|")[-1] if "|" in str(tag) else tag
                        
                        # Fetch hotel metadata
                        h_res = db.table("scan_tasks").select("hotel_id").eq("id", scan_task_id).execute()
                        if h_res.data:
                            h_id = h_res.data[0]["hotel_id"]
                            hotel_res = db.table("hotels").select("name", "property_token").eq("id", h_id).execute()
                            if hotel_res.data:
                                target_name = hotel_res.data[0]["name"]
                                target_token = hotel_res.data[0]["property_token"]
                                logger.info(f"DataForSEO: Resolved identity from DB for tag {tag}: {target_name} ({target_token})")
                    except Exception as e:
                        logger.error(f"DataForSEO: Failed to resolve identity from DB for tag {tag}: {e}")

                # [KAIZEN 2026] UNIFIED IDENTITY ENFORCEMENT
                # We no longer take items[0] by default. We find the item that MATCHES our target.
                target = None

                # Step 1: Detect if we have a direct result (Shape B for hotel_info)
                has_direct_data = bool(
                    result.get("about")
                    or result.get("reviews")
                    or result.get("prices")
                    or result.get("title")
                )

                if has_direct_data:
                    # Shape B: The result itself is the target
                    target = result
                elif items:
                    # Shape A: Search items array for the target
                    if target_token:
                        # Priority 1: Exact Token Match (Case-Insensitive)
                        t_token = str(target_token).strip().lower()
                        for item in items:
                            i_token = str(item.get("hotel_identifier") or "").strip().lower()
                            if i_token == t_token:
                                target = item
                                break

                    if not target and target_name:
                        # Priority 2: Fuzzy Name Match
                        from difflib import SequenceMatcher
                        best_score = 0
                        norm_target = self._normalize_location(target_name).lower()

                        for item in items:
                            raw_title = item.get("title", "")
                            norm_title = self._normalize_location(raw_title).lower()
                            score = SequenceMatcher(None, norm_target, norm_title).ratio()
                            is_substring = (norm_target in norm_title or norm_title in norm_target)

                            if (is_substring and score > 0.60) or score > 0.65:
                                if score > best_score:
                                    target = item
                                    best_score = score

                # Fallback: If no identity context provided, take items[0] (backward compatibility)
                if not target and not target_token and not target_name and items:
                    target = items[0]

                if not target:
                    failure_msg = f"Identity mismatch for {target_name or 'Unknown'} (Token: {target_token}). Checked {len(items)} items."
                    if items:
                        # Add diagnostic info about what we found
                        found_names = [i.get("title") for i in items[:3]]
                        failure_msg += f" Found titles: {found_names}..."
                    
                    logger.warning(f"DataForSEO: {failure_msg}")
                    return {
                        "status": "failed",
                        "failure_reason": "identity_mismatch",
                        "message": failure_msg,
                        "tag": tag,
                        "details": {
                            "target_token": target_token,
                            "target_name": target_name,
                            "items_count": len(items)
                        }
                    }, res_json

                if (
                    "hotel_searches" in endpoint or endpoint == "hotel_search"
                ):

                    prices_data = target.get("prices", {})
                    reviews_data = target.get("reviews", {})

                    # OTA Parity / All Prices
                    raw_prices_raw = prices_data.get("items", []) or []
                    raw_prices = []
                    for pi in raw_prices_raw:
                        if isinstance(pi, dict):
                            mapped = pi.copy()
                            # [FIX] Prioritize vendor/source over title. title is the room name.
                            mapped["source"] = pi.get("source") or pi.get("vendor") or pi.get("title")
                            mapped["room_type"] = pi.get("title") if (pi.get("source") or pi.get("vendor")) else None
                            mapped["url"] = pi.get("url") or pi.get("source_url")
                            raw_prices.append(mapped)

                    # [FIX 2026-04-25] Fallback: If no price items, check market_data or top-level fields
                    if not raw_prices:
                        market_data = target.get("market_data", {})
                        if market_data:
                            m_price = market_data.get("price")
                            m_currency = market_data.get("currency")
                            if m_price:
                                raw_prices = [{
                                    "source": "Market Data",
                                    "price": m_price,
                                    "currency": m_currency,
                                    "is_best": True
                                }]
                                # Ensure prices_data reflects this for downstream keys
                                if not prices_data.get("price"):
                                    prices_data["price"] = m_price
                                if not prices_data.get("currency"):
                                    prices_data["currency"] = m_currency
                        
                        # Some shapes have top-level price/currency
                        top_price = target.get("price")
                        top_currency = target.get("currency")
                        if not raw_prices and top_price:
                            raw_prices = [{
                                "source": "Search Result",
                                "price": top_price,
                                "currency": top_currency,
                                "is_best": True
                            }]
                            if not prices_data.get("price"):
                                prices_data["price"] = top_price
                            if not prices_data.get("currency"):
                                prices_data["currency"] = top_currency

                        # Add fallback for prices block directly having price/currency
                        if not raw_prices and prices_data.get("price"):
                            raw_prices = [{
                                "source": "Direct Search",
                                "price": prices_data.get("price"),
                                "currency": prices_data.get("currency"),
                                "is_best": True
                            }]
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

                    # === Room Types Extraction ===
                    # [FIX 2026-04-22] The hotel_searches batch endpoint does NOT
                    # populate a top-level "room_types" key on the item. Room/offer
                    # metadata lives inside prices.items[] — each price item has a
                    # "title" field containing the room name/offer description.
                    # We build a room_catalog matching the same schema as
                    # _parse_advanced_hotel_info() so the downstream pipeline
                    # (scan_persistence.py) and frontend receive identical structures.
                    room_catalog = []
                    seen_room_names = set()
                    for price_item in raw_prices:
                        if not isinstance(price_item, dict):
                            continue
                        room_title = price_item.get("title") or price_item.get("type") or "Standard Room"
                        # Deduplicate by normalized name + source so that the same
                        # room type from different OTAs is kept as separate entries
                        normalized = self._normalize_room_name(room_title)
                        if normalized.get("is_vendor"):
                            continue
                            
                        source_val = str(price_item.get("source") or price_item.get("vendor") or "")
                        norm_key = f"{normalized.get('name', '').lower()}|{source_val.lower()}"
                        if norm_key and norm_key not in seen_room_names:
                            seen_room_names.add(norm_key)
                            room_catalog.append({
                                "name": normalized.get("name") or room_title,
                                "original_name": normalized.get("original_name", room_title),
                                "price": price_item.get("price_raw") or price_item.get("price"),
                                "currency": price_item.get("currency"),
                                "source": price_item.get("source") or price_item.get("vendor"),
                                "url": price_item.get("source_url") or price_item.get("url"),
                                "capacity": price_item.get("capacity"),
                                "features": price_item.get("features"),
                                "image_url": price_item["images"][0] if isinstance(price_item.get("images"), list) and price_item["images"] else None,
                                "attributes": normalized.get("attributes", {}),
                            })

                    # Fallback: check if the item itself has a top-level room_types list
                    # (some response variants may include it as string names)
                    if not room_catalog:
                        room_types_raw = target.get("room_types") or []
                        if isinstance(room_types_raw, list) and room_types_raw:
                            for rt in room_types_raw:
                                if isinstance(rt, str):
                                    normalized = self._normalize_room_name(rt)
                                    room_catalog.append({
                                        "name": normalized.get("name", rt),
                                        "original_name": normalized.get("original_name", rt),
                                        "price": None,
                                        "currency": None,
                                        "source": None,
                                        "url": None,
                                        "capacity": None,
                                        "features": None,
                                        "image_url": None,
                                        "attributes": normalized.get("attributes", {}),
                                    })
                                elif isinstance(rt, dict):
                                    room_catalog.append(rt)

                    # Final Fallback: if room_catalog is STILL empty after all parsing and fallbacks:
                    if not room_catalog and raw_prices:
                        # Fallback to first price item
                        p_item = raw_prices[0]
                        normalized = self._normalize_room_name("Standard Room")
                        room_catalog.append({
                            "name": normalized.get("name") or "Standard Room",
                            "original_name": normalized.get("original_name", "Standard Room"),
                            "price": p_item.get("price_raw") or p_item.get("price"),
                            "currency": p_item.get("currency"),
                            "source": p_item.get("source") or "Direct Search",
                            "url": p_item.get("source_url") or p_item.get("url"),
                            "capacity": p_item.get("capacity"),
                            "features": p_item.get("features"),
                            "image_url": p_item["images"][0] if isinstance(p_item.get("images"), list) and p_item["images"] else None,
                            "attributes": normalized.get("attributes", {}),
                        })

                    # Build the same dual-key output as _parse_advanced_hotel_info:
                    # "room_catalog" = full objects, "room_types" = name strings
                    normalized_rooms = room_catalog
                    room_type_names = [r["name"] for r in room_catalog if r.get("name")]

                    # Sentiment Fallback
                    search_sentiment = target.get("reviews_breakdown", {}).get(
                        "sentiment", []
                    )

                    # [FIX 3] Only emit price if API actually returned one (not None/0)
                    raw_price = prices_data.get("price")

                    # [FIX 2026-05-02] Echo check-in/check-out dates from the submitted
                    # task payload (task["data"]) so scan_persistence.py can write them
                    # to price_logs.check_in_date / check_out_date.  Fallback to the
                    # prices block inside the response body (hotel_info/advanced shape).
                    task_data = task.get("data") or {}
                    check_in_date = (
                        task_data.get("check_in")
                        or task_data.get("check_in_date")
                        or prices_data.get("check_in")
                    )
                    check_out_date = (
                        task_data.get("check_out")
                        or task_data.get("check_out_date")
                        or prices_data.get("check_out")
                    )

                    result_dict = {
                        "status": "success",
                        "task_type": "price_search",
                        "currency": prices_data.get("currency"), # [FIX] Remove hardcoded TRY default
                        "property_token": target.get("hotel_identifier"),
                        "hotel_name": target.get("title"),
                        "stars": target.get("stars"),
                        "rating": reviews_data.get("value", 0.0),
                        "reviews": reviews_data.get("votes_count", 0),
                        "room_catalog": room_catalog,
                        "room_types": room_type_names,
                        "tag": task_data.get("tag"),
                        "check_in_date": check_in_date,
                        "check_out_date": check_out_date,
                        "ota_prices": sorted_prices,
                        "all_prices": sorted_prices,
                        "parity_offers": sorted_prices,
                        "offers": sorted_prices,
                        "sentiment_breakdown": search_sentiment,
                        "raw_data": target,
                        "items": items,
                    }
                    # Only include price if it's a real positive number
                    if raw_price and float(raw_price) > 0:
                        result_dict["price"] = float(raw_price)
                    return result_dict, res_json

                if "hotel_info" in endpoint:
                    # [FIX 2026-04-19] hotel_info/advanced has TWO response shapes.
                    # Unified matching has already set 'target' to either the specific item
                    # (Shape A) or the result object itself (Shape B).
                    
                    # Try the target first; if it doesn't have hotel_info, use the result object.
                    if (
                        target.get("hotel_info")
                        or target.get("about")
                        or target.get("reviews")
                    ):
                        parsed = self._parse_advanced_hotel_info(target)
                    else:
                        parsed = self._parse_advanced_hotel_info(result)

                    info_result = {
                        "status": "success",
                        "task_type": "hotel_info",
                        "tag": (task.get("data") or {}).get("tag"),
                        **parsed,
                    }
                    return info_result, res_json
                    
                return {
                    "status": "failed",
                    "failure_reason": "unhandled_endpoint",
                    "message": f"Endpoint {endpoint} was not handled correctly."
                }, res_json

        except Exception as e:
            logger.error(f"DataForSEO GET error ({endpoint}): {e}")
            return {
                "status": "failed",
                "failure_reason": "exception",
                "message": str(e)
            }, None

    async def get_task_result(
        self,
        task_id: str,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
        target_token: Optional[str] = None,
        target_name: Optional[str] = None,
        task_type: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
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
            processed, res_json = await self._fetch_results_generic(
                task_id,
                "hotel_info/advanced",
                target_token=target_token,
                target_name=target_name,
                db=db,
            )

            # [EVERYTHING VAULT] Capture the raw GET response
            if db and session_id and res_json:
                await self._vault_log(
                    db, session_id, "business_data/google/hotel_info/advanced/task_get", res_json
                )

            return processed, res_json
        else:
            # Default: price_search via hotel_searches
            # [FIX 2026-05-04] REMOVED "/advanced" suffix. 
            # hotel_searches results are retrieved via task_get/{id} directly.
            # Adding /advanced causes a 404 because that method doesn't exist for this endpoint.
            processed, res_json = await self._fetch_results_generic(
                task_id,
                "hotel_searches",
                target_token=target_token,
                target_name=target_name,
                db=db,
            )

            # [EVERYTHING VAULT] Capture the raw GET response
            if db and session_id and res_json:
                await self._vault_log(
                    db, session_id, "business_data/google/hotel_searches/task_get", res_json
                )

            return processed, res_json

    async def get_tasks_bulk(
        self,
        tasks_metadata: List[Dict[str, Any]],
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> List[Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]]:
        """
        Implementation of bulk result retrieval using asyncio.gather for high concurrency.
        Each task is fetched independently; exceptions are caught and returned as None.
        """
        if not tasks_metadata:
            return []

        async def _fetch_safe(meta):
            try:
                task_id = meta.get("external_task_id")
                if not task_id:
                    return {
                        "status": "failed",
                        "failure_reason": "invalid_request",
                        "message": "Missing external_task_id in metadata"
                    }, None
                
                # Extract other metadata for context (e.g. tag, hotel_id)
                context = {k: v for k, v in meta.items() if k != "external_task_id"}
                
                return await self.get_task_result(
                    task_id=task_id,
                    db=db,
                    session_id=session_id,
                    **context
                )
            except Exception as e:
                logger.error(f"DataForSEO: Bulk fetch error for task {meta.get('external_task_id')}: {e}")
                return {
                    "status": "failed",
                    "failure_reason": "exception",
                    "message": str(e)
                }, None

        # Execute all fetches in parallel
        results = await asyncio.gather(*[_fetch_safe(m) for m in tasks_metadata])
        return list(results)

    # [REMOVED 2026-05] get_completed_tasks and _get_ready_tasks_generic removed.
    # We now use Webhooks (handle_dataforseo_webhook) + Recovery Loop in monitor_service.



# Global instance for service usage
dataforseo_provider = DataForSEOProvider()
