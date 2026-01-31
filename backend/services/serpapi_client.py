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
from typing import Optional, List, Dict, Any
from datetime import date, timedelta, datetime
from dotenv import load_dotenv
import threading

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
        self._exhaustion_cooldown = timedelta(hours=24)  # Reset after 24h
    
    @property
    def current_key(self) -> str:
        """Get the current active API key."""
        with self._lock:
            if not self._keys:
                raise ValueError("No API keys configured")
            return self._keys[self._current_index]

    @property
    def total_keys(self) -> int:
        """Total number of API keys available."""
        return len(self._keys)
    
    @property
    def active_keys(self) -> int:
        """Number of non-exhausted keys."""
        now = datetime.now()
        active = 0
        for key in self._keys:
            if key not in self._exhausted_keys:
                active += 1
            elif now - self._exhausted_keys[key] > self._exhaustion_cooldown:
                active += 1  # Cooldown expired
        return active
    
    def rotate_key(self, reason: str = "quota_exhausted") -> bool:
        """Mark current key as exhausted and rotate to next available key."""
        with self._lock:
            if not self._keys:
                return False

            current_key = self._keys[self._current_index]
            self._exhausted_keys[current_key] = datetime.now()
            
            # Try to find next available key
            attempts = 0
            while attempts < len(self._keys):
                self._current_index = (self._current_index + 1) % len(self._keys)
                next_key = self._keys[self._current_index]
                
                if next_key in self._exhausted_keys:
                    exhaust_time = self._exhausted_keys[next_key]
                    if datetime.now() - exhaust_time > self._exhaustion_cooldown:
                        del self._exhausted_keys[next_key]
                        print(f"[SerpApi] Rotated to key {self._current_index + 1}/{len(self._keys)} (cooldown expired)")
                        return True
                else:
                    print(f"[SerpApi] Rotated to key {self._current_index + 1}/{len(self._keys)}")
                    return True
                
                attempts += 1
            
            print("[SerpApi] WARNING: All API keys are exhausted!")
            return False
    
    def reset_all(self):
        """Reset all keys."""
        with self._lock:
            self._exhausted_keys.clear()
            self._current_index = 0
            print("[SerpApi] All keys reset to active status")
    
    def reload_keys(self, new_keys: List[str]):
        """Reload API keys."""
        with self._lock:
            self._keys = new_keys or []
            self._current_index = 0
            self._exhausted_keys.clear()
            print(f"[SerpApi] Reloaded keys. Total: {len(self._keys)}")

    def get_status(self) -> Dict[str, Any]:
        """Get current status of all API keys."""
        with self._lock:
            idx = self._current_index + 1 if self._keys else 0
            status = {
                "total_keys": len(self._keys),
                "current_key_index": idx,
                "exhausted_keys": len(self._exhausted_keys),
                "active_keys": self.active_keys,
                "keys_status": []
            }
            for i, key in enumerate(self._keys):
                key_info = {
                    "index": i + 1,
                    "key_suffix": f"...{key[-6:]}" if len(key) > 6 else "***",
                    "is_current": i == self._current_index,
                    "is_exhausted": key in self._exhausted_keys
                }
                if key in self._exhausted_keys:
                    key_info["exhausted_at"] = self._exhausted_keys[key].isoformat()
                status["keys_status"].append(key_info)
            return status


class SerpApiClient:
    """Client for fetching hotel prices from SerpApi with rotating keys."""
    
    def __init__(self, api_keys: Optional[List[str]] = None):
        keys = api_keys or load_api_keys()
        if not keys:
            print("[SerpApi] WARNING: No API keys found in environment.")
        
        self._key_manager = ApiKeyManager(keys)
        print(f"[SerpApi] Initialized with {self._key_manager.total_keys} API key(s)")

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
    
    def get_key_status(self) -> Dict[str, Any]:
        current_keys = load_api_keys()
        if len(current_keys) != self._key_manager.total_keys:
             self._key_manager.reload_keys(current_keys)
        return self._key_manager.get_status()

    def _normalize_string(self, text: Optional[str]) -> str:
        if not text: return ""
        return " ".join(word.capitalize() for word in text.split())

    def _clean_hotel_name(self, name: str) -> str:
        if not name: return ""
        cleaned = name.split(" - ")[0].split(" | ")[0].split(" (")[0]
        phrases = ["Best Price Guaranteed", "Special Offer", "Official Site", "Low Price", "Book Now", "Free Cancellation"]
        for phrase in phrases:
            cleaned = re.sub(re.escape(phrase), "", cleaned, flags=re.IGNORECASE).strip()
        return self._normalize_string(cleaned)
    
    def _is_quota_error(self, response: httpx.Response) -> bool:
        if response.status_code == 429: return True
        try:
            error = response.json().get("error", "").lower()
            if any(x in error for x in ["quota", "limit", "exceeded"]): return True
        except: pass
        return False

    def _clean_price_string(self, price: Any, currency: str) -> Optional[float]:
        """Robusly clean price string into a float."""
        if price is None: return None
        if isinstance(price, (int, float)): return float(price)
            
        s_price = str(price).strip().replace('\xa0', ' ')
        clean_str = re.sub(r'[^\d.,]', '', s_price)
        if not clean_str: return None
        
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

    def _parse_market_offers(self, prices_data: List[Dict[str, Any]], currency: str) -> List[Dict[str, Any]]:
        offers = []
        for p in prices_data:
            raw = p.get("rate_per_night", {}).get("lowest") if isinstance(p.get("rate_per_night"), dict) else p.get("rate_per_night")
            price = self._clean_price_string(raw, currency)
            if price is not None:
                offers.append({
                    "vendor": p.get("source") or "Unknown",
                    "price": price,
                    "currency": currency
                })
        return offers

    def _extract_all_room_types(self, best_match: Dict[str, Any], currency: str) -> List[Dict[str, Any]]:
        """Extract room types from featured_prices or rooms array."""
        rooms = []
        room_names = set()
        raw_rooms = []
        if best_match.get("rooms"): raw_rooms.extend(best_match["rooms"])
        if best_match.get("room_types"): raw_rooms.extend(best_match["room_types"])
        featured = best_match.get("featured_prices", []) or []
        for p in featured:
            if "rooms" in p: raw_rooms.extend(p["rooms"])
        prices = best_match.get("prices", []) or []
        for p in prices:
            if "rooms" in p: raw_rooms.extend(p["rooms"])

        for r in raw_rooms:
            name = r.get("name") or r.get("title")
            if not name or name in room_names: continue
            raw_p = r.get("rate_per_night", {}).get("lowest") if isinstance(r.get("rate_per_night"), dict) else r.get("rate_per_night") or r.get("price")
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
                "start": offset
            }
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(SERPAPI_BASE_URL, params=params)
                    if self._is_quota_error(response):
                        if self._key_manager.rotate_key():
                            params["api_key"] = self.api_key
                            response = await client.get(SERPAPI_BASE_URL, params=params)
                        else: break
                    
                    response.raise_for_status()
                    data = response.json()
                    properties = data.get("properties", [])
                    
                    if not properties:
                        break
                        
                    for p in properties:
                        all_results.append({
                            "name": self._clean_hotel_name(p.get("name", "")), 
                            "location": p.get("location", "Unknown"), 
                            "serp_api_id": p.get("hotel_id") or p.get("property_token"), 
                            "source": "serpapi",
                            "stars": p.get("extracted_hotel_class"),
                            "rating": p.get("overall_rating"),
                            "review_count": p.get("reviews"),
                            "description": p.get("description"),
                            "amenities": p.get("amenities", []),
                            "image_url": p.get("images", [{}])[0].get("thumbnail") if p.get("images") else None,
                            "images": p.get("images", [])
                        })
                    
                    # Pagination Check
                    pagination = data.get("serpapi_pagination", {})
                    if not pagination.get("next"):
                        break
                        
                    offset += 20
                    page_count += 1
                    
            except Exception as e:
                print(f"[SerpApi] Search Error: {e}")
                break
                
        return all_results[:limit]

    async def fetch_hotel_price(self, hotel_name: str, location: str, check_in: Optional[date] = None, 
                               check_out: Optional[date] = None, adults: int = 2, currency: str = "USD", 
                               serp_api_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not check_in: check_in = date.today()
        if not check_out: check_out = check_in + timedelta(days=1)
        params = {"engine": "google_hotels", "q": f"{hotel_name} {location}", "check_in_date": check_in.isoformat(),
                  "check_out_date": check_out.isoformat(), "adults": adults, "currency": currency, "gl": "us", "hl": "en", "api_key": self.api_key}
        if serp_api_id: params["property_token"] = serp_api_id
        if currency == "TRY": params["gl"], params["hl"] = "tr", "tr"
        elif currency == "GBP": params["gl"] = "uk"
        elif currency == "EUR": params["gl"] = "fr"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(SERPAPI_BASE_URL, params=params)
                if self._is_quota_error(response):
                    if self._key_manager.rotate_key():
                        params["api_key"] = self.api_key
                        response = await client.get(SERPAPI_BASE_URL, params=params)
                    else: return None
                response.raise_for_status()
                return self._parse_hotel_result(response.json(), hotel_name, currency, serp_api_id)
        except Exception as e:
            print(f"[SerpApi] Error fetching {hotel_name}: {e}")
            return None

    def _parse_hotel_result(self, data: Dict[str, Any], target_hotel: str, default_currency: str = "USD", 
                           target_serp_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        properties = data.get("properties", [])
        best_match = None
        if not properties and data.get("rate_per_night"):
             best_match = {"name": data.get("name"), "prices": data.get("prices", []), "rate_per_night": data.get("rate_per_night"),
                           "amenities": data.get("amenities", []), "images": data.get("images", []), "overall_rating": data.get("overall_rating"),
                           "property_token": data.get("property_token")}
        if not best_match:
            for prop in properties:
                if str(prop.get("hotel_id")) == str(target_serp_id) or prop.get("property_token") == target_serp_id:
                    best_match = prop; break
            if not best_match:
                for prop in properties:
                    if target_hotel.lower() in prop.get("name", "").lower():
                        best_match = prop; break
            if not best_match and properties: best_match = properties[0]
        if not best_match: return None

        raw_price = None
        if "rate_per_night" in best_match:
            r = best_match["rate_per_night"]
            raw_price = r.get("extracted_lowest") if isinstance(r, dict) else r
        elif "price" in best_match: raw_price = best_match["price"]
        elif best_match.get("prices"):
            r = best_match["prices"][0].get("rate_per_night", {})
            raw_price = r.get("extracted_lowest") if isinstance(r, dict) else r

        price = self._clean_price_string(raw_price, default_currency)
        
        return {
            "hotel_name": self._clean_hotel_name(best_match.get("name", target_hotel)),
            "price": price, "currency": default_currency, "source": "serpapi",
            "vendor": best_match.get("deal_description", "Unknown"),
            "rating": best_match.get("overall_rating"),
            "review_count": best_match.get("reviews"),
            "stars": best_match.get("extracted_hotel_class"),
            "property_token": best_match.get("property_token"),
            "image_url": best_match.get("images", [{}])[0].get("thumbnail"),
            "amenities": best_match.get("amenities", []),
            "images": [{"thumbnail": i.get("thumbnail"), "original": i.get("original")} for i in best_match.get("images", [])[:10]],
            "offers": self._parse_market_offers(best_match.get("prices", []), default_currency),
            "room_types": self._extract_all_room_types(best_match, default_currency),
            "raw_data": best_match
        }

    async def fetch_multiple_hotels(self, hotels: List[Dict[str, str]], check_in: Optional[date] = None, 
                                   check_out: Optional[date] = None, currency: str = "USD") -> Dict[str, Any]:
        results = {}
        for h in hotels:
            results[h["name"]] = await self.fetch_hotel_price(h["name"], h["location"], check_in, check_out, 2, currency, h.get("serp_api_id"))
        return results

serpapi_client = SerpApiClient()
