"""
SerpApi Client for Hotel Price Fetching
Fetches real-time hotel prices from Google Hotels via SerpApi.

Features:
- Rotating API keys with automatic failover on quota exhaustion
- Rate limiting awareness
- Connection pooling
"""

import os
import httpx
import re
import threading
import asyncio
from typing import Optional, List, Dict, Any
from datetime import date, timedelta, datetime
from dotenv import load_dotenv
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

load_dotenv()
load_dotenv(".env.local", override=True)

SERPAPI_BASE_URL = "https://serpapi.com/search"


# Load multiple API keys from environment
def load_api_keys() -> List[str]:
    """Load all available SerpApi keys from environment."""
    keys = []

    # Primary key (Try both naming conventions)
    primary = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
    if primary:
        keys.append(primary)

    # Check for numbered backup keys (up to 10)
    for i in range(2, 11):
        key = os.getenv(f"SERPAPI_API_KEY_{i}")
        if key:
            keys.append(key)

    return keys


class ApiKeyManager:
    """
    Manages rotating API keys with automatic failover.
    Thread-safe for concurrent requests.
    """

    def __init__(self, keys: List[str]):
        self._keys = keys or []
        self._current_index = 0
        self._lock = threading.Lock()
        self._exhausted_keys: Dict[str, datetime] = {}  # key -> exhaustion time
        self._rate_limited_keys: Dict[str, datetime] = {}  # key -> 429 time
        self._usage_counts: Dict[str, int] = {
            k: 0 for k in self._keys
        }  # key -> request count
        self._quota_info: Dict[str, int] = {}  # key -> searches_left
        self._renewal_info: Dict[str, str] = {}  # key -> renewal_date
        self._last_quota_check: Dict[str, datetime] = {}  # key -> last check time
        self._exhaustion_cooldown = timedelta(hours=24)  # Reset after 24h
        self._rate_limit_cooldown = timedelta(minutes=15)  # Reset after 15m

    async def _fetch_quota(self, api_key: str):
        """Fetch actual searches left from SerpApi Account API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"https://serpapi.com/account?api_key={api_key}"
                )
                if response.status_code == 200:
                    data = response.json()
                    left = data.get("total_searches_left", 0)
                    self._quota_info[api_key] = left
                    self._renewal_info[api_key] = data.get(
                        "plan_renewal_date", "Unknown"
                    )
                    self._last_quota_check[api_key] = datetime.now()

                    # Also update exhaustion status based on real data (PROACTIVE HEALING)
                    if left <= 0:
                        self._exhausted_keys[api_key] = datetime.now()
                    else:
                        # If left > 0, it's healthy. Clear all lockout statuses immediately.
                        if api_key in self._exhausted_keys:
                            del self._exhausted_keys[api_key]
                        if api_key in self._rate_limited_keys:
                            del self._rate_limited_keys[api_key]

                    return left
        except Exception as e:
            logger.error(f"Quota Check Error for {api_key[-6:]}: {e}")
        return None

    @property
    def current_key(self) -> str:
        """Get the current active API key."""
        with self._lock:
            if not self._keys:
                raise ValueError("No API keys configured")

            # PROACTIVE ROTATION (Kaizen 2026)
            # If the current key is known to be exhausted or rate-limited, skip it immediately.
            current_key = self._keys[self._current_index]
            if current_key in self._exhausted_keys or current_key in self._rate_limited_keys:
                logger.info(
                    f"Key {self._current_index + 1} known to be limited. Proactively rotating..."
                )
                self._rotate_key_locked("proactive_skip")

            key = self._keys[self._current_index]
            self._usage_counts[key] = self._usage_counts.get(key, 0) + 1
            return key

    @property
    def total_keys(self) -> int:
        """Total number of API keys available."""
        return len(self._keys)

    @property
    def active_keys(self) -> int:
        """Number of non-exhausted and non-rate-limited keys."""
        now = datetime.now()
        active = 0
        for key in self._keys:
            is_valid = True
            if key in self._exhausted_keys:
                if now - self._exhausted_keys[key] <= self._exhaustion_cooldown:
                    is_valid = False
                else:
                    del self._exhausted_keys[key]  # Cleanup
            
            if is_valid and key in self._rate_limited_keys:
                if now - self._rate_limited_keys[key] <= self._rate_limit_cooldown:
                    is_valid = False
                else:
                    del self._rate_limited_keys[key]  # Cleanup

            if is_valid:
                active += 1
        return active

    @property
    def current_key_index(self) -> int:
        """Get the current key index (1-indexed for display)."""
        with self._lock:
            return self._current_index + 1 if self._keys else 0

    def rotate_key(
        self, reason: str = "quota_exhausted", is_permanent: bool = True
    ) -> bool:
        """Mark current key as exhausted and rotate to next available key."""
        with self._lock:
            return self._rotate_key_locked(reason, is_permanent)

    def _rotate_key_locked(
        self, reason: str = "quota_exhausted", is_permanent: bool = True
    ) -> bool:
        """Internal rotation logic (expects lock)."""
        if not self._keys:
            return False

        current_key = self._keys[self._current_index]

        # EXPLANATION: Smart Rotation logic
        if is_permanent:
            self._exhausted_keys[current_key] = datetime.now()
            logger.warning(
                f"Key {self._current_index + 1} PERMANENTLY exhausted (24h cooldown). Reason: {reason}"
            )
        else:
            self._rate_limited_keys[current_key] = datetime.now()
            logger.info(
                f"Key {self._current_index + 1} hitting temporary limit (15m cooldown). Rotating..."
            )

        # Try to find next available key
        attempts = 0
        while attempts < len(self._keys):
            self._current_index = (self._current_index + 1) % len(self._keys)
            next_key = self._keys[self._current_index]

            # Check if the next key is currently BANNED or RESTRICTED
            is_limited = False
            if next_key in self._exhausted_keys:
                if datetime.now() - self._exhausted_keys[next_key] > self._exhaustion_cooldown:
                    del self._exhausted_keys[next_key]
                else:
                    is_limited = True

            if not is_limited and next_key in self._rate_limited_keys:
                if datetime.now() - self._rate_limited_keys[next_key] > self._rate_limit_cooldown:
                    del self._rate_limited_keys[next_key]
                else:
                    is_limited = True

            if not is_limited:
                logger.info(
                    f"Rotated to key {self._current_index + 1}/{len(self._keys)}"
                )
                return True

            attempts += 1

        logger.warning("All API keys are exhausted or banned!")
        return False

    def reset_all(self):
        """Reset all keys."""
        with self._lock:
            self._exhausted_keys.clear()
            self._quota_info.clear()
            self._current_index = 0
            logger.info("All keys reset to active status")

    def reload_keys(self, new_keys: List[str]):
        """Reload API keys."""
        with self._lock:
            self._keys = new_keys or []
            self._current_index = 0
            self._exhausted_keys.clear()
            self._quota_info.clear()
            logger.info(f"Reloaded keys. Total: {len(self._keys)}")

    async def get_detailed_status(self) -> Dict[str, Any]:
        """Get detailed status including per-key usage and REAL quota."""
        keys_status = []

        # Check quotas first
        tasks = [self._fetch_quota(k) for k in self._keys]
        await asyncio.gather(*tasks)

        with self._lock:
            # TRIGGER PROACTIVE ROTATION (Kaizen 2026)
            # If the current key was just found to be exhausted during quota fetch, rotate now
            curr_key = self._keys[self._current_index]
            if curr_key in self._exhausted_keys:
                logger.info(
                    f"Key {self._current_index + 1} found exhausted during status check. Rotating..."
                )
                self._rotate_key_locked("proactive_status_check")

            for i, key in enumerate(self._keys):
                key_info = {
                    "index": i + 1,
                    "key_suffix": f"...{key[-6:]}" if len(key) > 6 else "***",
                    "is_current": i == self._current_index,
                    "is_exhausted": key in self._exhausted_keys,
                    "is_rate_limited": key in self._rate_limited_keys,
                    "usage": self._usage_counts.get(key, 0),
                    "searches_left": self._quota_info.get(key),
                    "renewal_date": self._renewal_info.get(key, "Unknown"),
                }
                if key in self._exhausted_keys:
                    key_info["exhausted_at"] = self._exhausted_keys[key].isoformat()
                if key in self._rate_limited_keys:
                    key_info["rate_limited_at"] = self._rate_limited_keys[key].isoformat()
                keys_status.append(key_info)

            return {
                "total_keys": len(self._keys),
                "active_keys": self.active_keys,
                "current_index": self._current_index + 1 if self._keys else 0,
                "keys_status": keys_status,
            }

    def get_status(self) -> Dict[str, Any]:
        """Get current status of all API keys."""
        with self._lock:
            idx = self._current_index + 1 if self._keys else 0
            status = {
                "total_keys": len(self._keys),
                "current_key_index": idx,
                "exhausted_keys": len(self._exhausted_keys),
                "active_keys": self.active_keys,
                "keys_status": [],
            }
            for i, key in enumerate(self._keys):
                key_info = {
                    "index": i + 1,
                    "key_suffix": f"...{key[-6:]}" if len(key) > 6 else "***",
                    "is_current": i == self._current_index,
                    "is_exhausted": key in self._exhausted_keys,
                    "is_rate_limited": key in self._rate_limited_keys,
                    "usage": self._usage_counts.get(key, 0),
                }
                if key in self._exhausted_keys:
                    key_info["exhausted_at"] = self._exhausted_keys[key].isoformat()
                if key in self._rate_limited_keys:
                    key_info["rate_limited_at"] = self._rate_limited_keys[key].isoformat()
                status["keys_status"].append(key_info)
            return status


class SerpApiClient:
    """Client for fetching hotel prices from SerpApi with rotating keys."""

    def __init__(self, api_keys: Optional[List[str]] = None):
        keys = api_keys or load_api_keys()
        if not keys:
            logger.warning("No API keys found in environment.")

        self._key_manager = ApiKeyManager(keys)
        logger.info(f"Initialized with {self._key_manager.total_keys} API key(s)")

    def reload(self):
        """Force reload keys from environment."""
        try:
            keys = load_api_keys()
            self._key_manager.reload_keys(keys)
            return {"status": "success", "total_keys": len(keys)}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @property
    def api_key(self) -> str:
        return self._key_manager.current_key

    async def get_key_status(self) -> Dict[str, Any]:
        current_keys = load_api_keys()
        if len(current_keys) != self._key_manager.total_keys:
            self._key_manager.reload_keys(current_keys)
        return await self._key_manager.get_detailed_status()

    async def get_detailed_status(self) -> Dict[str, Any]:
        """Returns comprehensive status including usage per key."""
        return await self.get_key_status()

    def get_status(self) -> Dict[str, Any]:
        """Returns basic cached status (sync)."""
        return self._key_manager.get_status()

    def _normalize_string(self, text: Optional[str]) -> str:
        if not text:
            return ""
        return " ".join(word.capitalize() for word in text.split())

    def _clean_hotel_name(self, name: str) -> str:
        if not name:
            return ""
        cleaned = name.split(" - ")[0].split(" | ")[0].split(" (")[0]
        phrases = [
            "Best Price Guaranteed",
            "Special Offer",
            "Official Site",
            "Low Price",
            "Book Now",
            "Free Cancellation",
        ]
        for phrase in phrases:
            cleaned = re.sub(
                re.escape(phrase), "", cleaned, flags=re.IGNORECASE
            ).strip()
        return self._normalize_string(cleaned)

    def _is_quota_error(self, response: httpx.Response) -> tuple[bool, bool]:
        """Returns (is_error, is_permanent)."""
        # EXPLANATION: Error Differentiation (Kaizen 2026)
        # 429 means "Too many requests per second" (Temporary).
        # We only mark as PERMANENT if status is 403 (Daily Limit/Account Ban)
        # and it specifically mentions credits or quota.
        if response.status_code == 429:
            return True, False

        try:
            error_data = response.json().get("error", "").lower()
            # Hard quota phrases
            permanent_phrases = ["quota", "run out", "searches", "insufficient credits"]

            # If 403 AND a permanent phrase is found, it's a hard ban.
            # If 429 or other status, we treat as temporary rotation.
            if response.status_code == 403 and any(
                x in error_data for x in permanent_phrases
            ):
                return True, True

            # General limit phrases - treat as temporary to allow rotation/retry
            if any(x in error_data for x in ["limit", "exceeded", "quota", "searches"]):
                return True, False
        except Exception:
            pass

        return False, False

    def _clean_price_string(self, price: Any, currency: str) -> Optional[float]:
        """Robusly clean price string into a float."""
        if price is None:
            return None
        if isinstance(price, (int, float)):
            return float(price)

        s_price = str(price).strip().replace("\xa0", " ")
        clean_str = re.sub(r"[^\d.,]", "", s_price)
        if not clean_str:
            return None

        if "," in clean_str and "." in clean_str:
            if clean_str.rfind(",") > clean_str.rfind("."):
                clean_str = clean_str.replace(".", "").replace(",", ".")
            else:
                clean_str = clean_str.replace(",", "")
        elif "," in clean_str:
            parts = clean_str.split(",")
            if len(parts[-1]) == 3 and len(parts) > 1:
                clean_str = clean_str.replace(",", "")
            else:
                clean_str = clean_str.replace(",", ".")
        elif "." in clean_str:
            parts = clean_str.split(".")
            if len(parts[-1]) == 3 and len(parts) > 1:
                if currency in ["TRY", "EUR", "IDR", "VND"]:
                    clean_str = clean_str.replace(".", "")

        try:
            return float(clean_str)
        except ValueError:
            return None

    def _parse_market_offers(
        self, prices_data: List[Dict[str, Any]], currency: str
    ) -> List[Dict[str, Any]]:
        offers = []
        for p in prices_data:
            # EXPLANATION: Deep Parsing (Kaizen 2026)
            # SerpApi uses various keys for price. We check them all to ensure Wilmont
            # and others show full market depth.
            raw = None
            # Check price containers
            price_keys = ["rate_per_night", "price", "total_rate", "rate"]
            for k in price_keys:
                val = p.get(k)
                if val:
                    raw = val.get("lowest") if isinstance(val, dict) else val
                    if raw:
                        break

            price = self._clean_price_string(raw, currency)
            if price is not None:
                offers.append(
                    {
                        "vendor": p.get("source") or p.get("name") or "Unknown",
                        "price": price,
                        "currency": currency,
                    }
                )
        return offers

    def _extract_all_room_types(
        self, best_match: Dict[str, Any], currency: str
    ) -> List[Dict[str, Any]]:
        """Extract room types from featured_prices or rooms array."""
        rooms = []
        room_names = set()
        raw_rooms = []
        if best_match.get("rooms"):
            raw_rooms.extend(best_match["rooms"])
        if best_match.get("room_types"):
            raw_rooms.extend(best_match["room_types"])
        featured = best_match.get("featured_prices", []) or []
        for p in featured:
            if "rooms" in p:
                raw_rooms.extend(p["rooms"])
        prices = best_match.get("prices", []) or []
        for p in prices:
            if "rooms" in p:
                raw_rooms.extend(p["rooms"])

        for r in raw_rooms:
            name = r.get("name") or r.get("title")
            if not name or name in room_names:
                continue
            raw_p = (
                r.get("rate_per_night", {}).get("lowest")
                if isinstance(r.get("rate_per_night"), dict)
                else r.get("rate_per_night") or r.get("price")
            )
            price = self._clean_price_string(raw_p, currency)
            rooms.append({"name": name, "price": price, "currency": currency})
            room_names.add(name)
        return rooms

    async def search_hotels(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        # Default to checking in tomorrow
        check_in = date.today() + timedelta(days=1)
        check_out = check_in + timedelta(days=1)

        all_results = []
        offset = 0
        max_pages = (limit // 20) + 2  # Safety cap
        page_count = 0

        while len(all_results) < limit and page_count < max_pages:
            params = {
                "engine": "google_hotels",
                "q": query,
                "gl": "us",
                "hl": "en",
                "check_in_date": check_in.isoformat(),
                "check_out_date": check_out.isoformat(),
                "api_key": self.api_key,
                "start": offset,
            }
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(SERPAPI_BASE_URL, params=params)

                    # Robust Rotation Loop: Continue trying other keys until success or exhaustion
                    is_err, is_perm = self._is_quota_error(response)
                    while is_err:
                        logger.warning(
                            f"Key {self._key_manager.current_key_index} encountered {'PERMANENT' if is_perm else 'TEMPORARY'} limit. Rotating..."
                        )
                        if self._key_manager.rotate_key(is_permanent=is_perm):
                            params["api_key"] = self.api_key
                            response = await client.get(SERPAPI_BASE_URL, params=params)
                            is_err, is_perm = self._is_quota_error(response)
                        else:
                            logger.critical(
                                "All SerpApi keys exhausted for search_hotels"
                            )
                            break

                    response.raise_for_status()
                    data = response.json()
                    properties = data.get("properties", [])

                    if not properties:
                        break

                    for p in properties:
                        all_results.append(
                            {
                                "name": self._clean_hotel_name(p.get("name", "")),
                                "location": p.get("location", "Unknown"),
                                "serp_api_id": p.get("hotel_id")
                                or p.get("property_token"),
                                "source": "serpapi",
                                "stars": p.get("extracted_hotel_class"),
                                "rating": p.get("overall_rating"),
                                "review_count": p.get("reviews"),
                                "description": p.get("description"),
                                "amenities": p.get("amenities", []),
                                "image_url": p.get("images", [{}])[0].get("thumbnail")
                                if p.get("images")
                                else None,
                                "images": p.get("images", []),
                            }
                        )

                    # Pagination Check
                    pagination = data.get("serpapi_pagination", {})
                    if not pagination.get("next"):
                        break

                    offset += 20
                    page_count += 1

            except Exception as e:
                logger.error(f"Search Error: {e}")
                break

        return all_results[:limit]

    async def fetch_hotel_price(
        self,
        hotel_name: str,
        location: str,
        check_in: Optional[date] = None,
        check_out: Optional[date] = None,
        adults: int = 2,
        currency: str = "USD",
        serp_api_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if not check_in:
            check_in = date.today()
        if not check_out:
            check_out = check_in + timedelta(days=1)
        params = {
            "engine": "google_hotels",
            "q": f"{hotel_name} {location}",
            "check_in_date": check_in.isoformat(),
            "check_out_date": check_out.isoformat(),
            "adults": adults,
            "currency": currency,
            "gl": "us",
            "hl": "en",
            "api_key": self.api_key,
        }
        if serp_api_id:
            if str(serp_api_id).isdigit():
                params["hotel_id"] = serp_api_id
            else:
                params["property_token"] = serp_api_id

        if currency == "TRY":
            params["gl"], params["hl"] = "tr", "tr"
        elif currency == "GBP":
            params["gl"] = "uk"
        elif currency == "EUR":
            params["gl"] = "fr"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(SERPAPI_BASE_URL, params=params)

                # Robust Rotation Loop: Continue trying other keys until success or exhaustion
                is_err, is_perm = self._is_quota_error(response)
                while is_err:
                    logger.warning(
                        f"Key {self._key_manager.current_key_index} encountered {'PERMANENT' if is_perm else 'TEMPORARY'} limit. Rotating..."
                    )
                    if self._key_manager.rotate_key(is_permanent=is_perm):
                        params["api_key"] = self.api_key
                        response = await client.get(SERPAPI_BASE_URL, params=params)
                        is_err, is_perm = self._is_quota_error(response)
                    else:
                        logger.critical(
                            "All SerpApi keys exhausted for fetch_hotel_price"
                        )
                        return {"error": "quota_exhausted", "status": "error"}

                response.raise_for_status()
                return self._parse_hotel_result(
                    response.json(), hotel_name, currency, serp_api_id
                )
        except Exception as e:
            logger.error(f"Error fetching {hotel_name}: {e}")
            return None

    def _parse_hotel_result(
        self,
        data: Dict[str, Any],
        target_hotel: str,
        default_currency: str = "USD",
        target_serp_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        properties = data.get("properties", [])
        best_match = None
        if not properties and data.get("rate_per_night"):
            best_match = {
                "name": data.get("name"),
                "prices": data.get("prices", []),
                "rate_per_night": data.get("rate_per_night"),
                "amenities": data.get("amenities", []),
                "images": data.get("images", []),
                "overall_rating": data.get("overall_rating"),
                "property_token": data.get("property_token"),
                "reviews_breakdown": data.get("reviews_breakdown", []),
                "reviews": data.get("reviews", []),
            }
        if not best_match:
            for prop in properties:
                if (
                    str(prop.get("hotel_id")) == str(target_serp_id)
                    or prop.get("property_token") == target_serp_id
                ):
                    best_match = prop
                    break
            if not best_match:
                for prop in properties:
                    if target_hotel.lower() in prop.get("name", "").lower():
                        best_match = prop
                        break
            if not best_match and properties:
                best_match = properties[0]
        if not best_match:
            return None

        raw_price = None
        if "rate_per_night" in best_match:
            r = best_match["rate_per_night"]
            raw_price = r.get("extracted_lowest") if isinstance(r, dict) else r
        elif "price" in best_match:
            raw_price = best_match["price"]
        elif best_match.get("prices"):
            r = best_match["prices"][0].get("rate_per_night", {})
            raw_price = r.get("extracted_lowest") if isinstance(r, dict) else r

        price = self._clean_price_string(raw_price, default_currency)

        # Combine all possible offer sources for market depth
        all_offers_raw = []
        if best_match.get("featured_prices"):
            all_offers_raw.extend(best_match["featured_prices"])
        if best_match.get("prices"):
            all_offers_raw.extend(best_match["prices"])

        parsed_offers = self._parse_market_offers(all_offers_raw, default_currency)

        # KAİZEN: Absolute Lowest Price Selection
        # Instead of trusting the top-level "raw_price", we scan the parsed offers
        # to find the true market minimum.
        if parsed_offers:
            # Sort by price ascending
            sorted_offers = sorted(parsed_offers, key=lambda x: x["price"])
            cheapest_offer = sorted_offers[0]

            # If our parsed minimum is lower than the featured top-level price, use it.
            if price is None or cheapest_offer["price"] < price:
                price = cheapest_offer["price"]
                best_match["deal_description"] = cheapest_offer[
                    "vendor"
                ]  # Update for vendor accuracy

        # Determine rank
        rank = None
        if properties and best_match:
            try:
                # Robust Rank Detection: Match by token or name if exact object reference fails
                target_token = best_match.get("property_token") or best_match.get(
                    "hotel_id"
                )
                target_name = best_match.get("name", "").lower()

                for idx, prop in enumerate(properties):
                    prop_token = prop.get("property_token") or prop.get("hotel_id")
                    if (target_token and prop_token == target_token) or (
                        prop.get("name", "").lower() == target_name
                    ):
                        rank = idx + 1
                        break
            except Exception:
                pass

        return {
            "hotel_name": self._clean_hotel_name(best_match.get("name", target_hotel)),
            "price": price,
            "currency": default_currency,
            "source": "serpapi",
            "vendor": best_match.get("deal_description")
            or best_match.get("vendor")
            or (
                best_match.get("featured_prices")[0].get("source")
                if best_match.get("featured_prices")
                else "SerpApi"
            ),
            "rating": best_match.get("overall_rating"),
            "review_count": best_match.get("reviews"),
            "stars": best_match.get("extracted_hotel_class"),
            "property_token": best_match.get("property_token"),
            "image_url": best_match.get("images", [{}])[0].get("thumbnail"),
            "amenities": best_match.get("amenities", []),
            "images": [
                {"thumbnail": i.get("thumbnail"), "original": i.get("original")}
                for i in best_match.get("images", [])[:10]
            ],
            "offers": parsed_offers,
            "room_types": self._extract_all_room_types(best_match, default_currency),
            "reviews_breakdown": self._normalize_reviews_breakdown(
                best_match.get("reviews_breakdown", []),
                best_match.get("overall_rating"),
            ),
            "reviews": best_match.get("reviews", []),
            "search_rank": rank,
            "latitude": best_match.get("gps_coordinates", {}).get("latitude"),
            "longitude": best_match.get("gps_coordinates", {}).get("longitude"),
            "raw_data": best_match,
        }

    def _normalize_reviews_breakdown(
        self, breakdown: List[Dict[str, Any]], overall_rating: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Ensures the 4 core pillars (Cleanliness, Service, Location, Value) exist."""
        valid = breakdown or []

        # Standardize keys
        standard_map = {
            "cleanliness": "Cleanliness",
            "clean": "Cleanliness",
            "room": "Cleanliness",
            "temizlik": "Cleanliness",
            "service": "Service",
            "staff": "Service",
            "hizmet": "Service",
            "personel": "Service",
            "location": "Location",
            "neighborhood": "Location",
            "konum": "Location",
            "mevki": "Location",
            "value": "Value",
            "price": "Value",
            "comfort": "Value",
            "değer": "Value",
            "fiyat": "Value",
            "kalite": "Value",
        }

        # Create a dictionary of existing scores
        existing = {}
        for item in valid:
            name = item.get("name", "").lower()
            if name in standard_map:
                existing[standard_map[name]] = item.get("rating") or item.get(
                    "total_score"
                )
            else:
                existing[name.title()] = item.get("rating")

        # Fill missing core categories with overall rating (fallback) or 0
        core_categories = ["Cleanliness", "Service", "Location", "Value"]
        final_breakdown = []

        for cat in core_categories:
            if cat in existing:
                final_breakdown.append(
                    {"name": cat, "rating": existing[cat], "sentiment": "neutral"}
                )
            else:
                # Fallback: If we have an overall rating, use it (minus penalty to be conservative), else 0
                fallback = (overall_rating - 0.5) if overall_rating else 0
                final_breakdown.append(
                    {
                        "name": cat,
                        "rating": max(0, fallback),
                        "sentiment": "neutral",
                        "is_inferred": True,
                    }
                )

        # Add any other non-core categories found
        for item in valid:
            name = item.get("name", "").title()
            if name not in core_categories and name not in ["Total"]:
                final_breakdown.append(item)

        return final_breakdown

    async def fetch_multiple_hotels(
        self,
        hotels: List[Dict[str, str]],
        check_in: Optional[date] = None,
        check_out: Optional[date] = None,
        currency: str = "USD",
    ) -> Dict[str, Any]:
        """HYPERSPEED KAIZEN: Parallelized batch fetching for auxiliary calls."""
        tasks = []
        for h in hotels:
            tasks.append(
                self.fetch_hotel_price(
                    h["name"],
                    h["location"],
                    check_in,
                    check_out,
                    2,
                    currency,
                    h.get("serp_api_id"),
                )
            )

        responses = await asyncio.gather(*tasks)
        return {h["name"]: resp for h, resp in zip(hotels, responses)}


serpapi_client = SerpApiClient()
