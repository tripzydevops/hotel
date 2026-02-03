import os
import httpx
import re
import threading
from typing import Optional, List, Dict, Any
from datetime import date, timedelta, datetime
from ..data_provider_interface import HotelDataProvider

# --- ApiKeyManager (Moved from original client for reuse) ---
class ApiKeyManager:
    """Manages rotating API keys with automatic failover."""
    def __init__(self, keys: List[str]):
        self._keys = keys or []
        self._current_index = 0
        self._lock = threading.Lock()
        self._exhausted_keys: Dict[str, datetime] = {}
        self._exhaustion_cooldown = timedelta(hours=24)
    
    @property
    def current_key(self) -> str:
        with self._lock:
            if not self._keys: raise ValueError("No API keys configured")
            return self._keys[self._current_index]

    def rotate_key(self) -> bool:
        with self._lock:
            if not self._keys: return False
            current_key = self._keys[self._current_index]
            self._exhausted_keys[current_key] = datetime.now()
            
            attempts = 0
            while attempts < len(self._keys):
                self._current_index = (self._current_index + 1) % len(self._keys)
                next_key = self._keys[self._current_index]
                if next_key not in self._exhausted_keys:
                    return True
                # Check cooldown
                if datetime.now() - self._exhausted_keys[next_key] > self._exhaustion_cooldown:
                    del self._exhausted_keys[next_key]
                    return True
                attempts += 1
            return False

def load_api_keys() -> List[str]:
    keys = []
    primary = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
    if primary: keys.append(primary)
    for i in range(2, 11):
        key = os.getenv(f"SERPAPI_API_KEY_{i}")
        if key: keys.append(key)
    return keys

# --- Provider Implementation ---

class SerpApiProvider(HotelDataProvider):
    """
    SerpApi Provider implementation for Google Hotels.
    """
    BASE_URL = "https://serpapi.com/search"

    def __init__(self):
        keys = load_api_keys()
        self._key_manager = ApiKeyManager(keys)

    def get_provider_name(self) -> str:
        return "SerpApi"

    async def fetch_price(
        self, 
        hotel_name: str, 
        location: str, 
        check_in: date, 
        check_out: date, 
        adults: int = 2, 
        currency: str = "USD",
        serp_api_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        
        async def do_fetch(q_str: str, token: Optional[str] = None) -> Optional[Dict[str, Any]]:
            params = {
                "engine": "google_hotels",
                "q": q_str,
                "check_in_date": check_in.isoformat(),
                "check_out_date": check_out.isoformat(),
                "adults": adults,
                "currency": currency,
                "gl": "tr" if currency == "TRY" else "us",
                "hl": "tr" if currency == "TRY" else "en",
                "api_key": self._key_manager.current_key
            }
            
            if token:
                if len(token) > 20: params["property_token"] = token
                else: params["hotel_class_id"] = token

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(self.BASE_URL, params=params)
                    current_key_suffix = self._key_manager.current_key[-5:]
                    
                    if self._is_quota_error(response):
                        print(f"[SerpApi] 429 Error on Key ...{current_key_suffix}")
                        if self._key_manager.rotate_key():
                            new_key = self._key_manager.current_key
                            print(f"[SerpApi] Rotating to Key ...{new_key[-5:]}")
                            params["api_key"] = new_key
                            response = await client.get(self.BASE_URL, params=params)
                        else:
                            print("[SerpApi] All configured keys exhausted.")
                            return None
                    
                if response.status_code == 200:
                        data = response.json()
                        if "error" in data:
                            print(f"[SerpApi] API Error: {data['error']} (Key: ...{current_key_suffix})")
                        return self._parse_hotel_result(data, hotel_name, currency)
            except Exception as e:
                print(f"[SerpApi] Fetch Error: {e}")
            return None

        # 1. Primary Attempt (with ID if available)
        search_query = f"{hotel_name} {location}" if location else hotel_name
        result = await do_fetch(search_query, serp_api_id)
        
        # 2. Fallback Attempt (without ID if ID failed or returned NOT_FOUND)
        if not result and serp_api_id:
            print(f"[SerpApi] NOT_FOUND with token. Retrying with fuzzy search: {search_query}")
            result = await do_fetch(search_query, None)

        # 3. Last Resort: Broader search (just name)
        if not result and location:
            print(f"[SerpApi] NOT_FOUND with location. Retrying with name only: {hotel_name}")
            result = await do_fetch(hotel_name, None)

        return result

    def _is_quota_error(self, response: httpx.Response) -> bool:
        if response.status_code == 429: return True
        try:
            return "quota" in response.json().get("error", "").lower()
        except: return False

    def _parse_hotel_result(self, data: Dict[str, Any], target_hotel: str, currency: str) -> Optional[Dict[str, Any]]:
        properties = data.get("properties", [])
        best_match = None
        
        # Remove common stop words for fuzzy matching
        ignore = ["hotel", "resort", "spa", "residences", "by", "wyndham", "hilton", "garden", "inn", "&"]
        target_norm = target_hotel.lower()
        for word in ignore:
            target_norm = target_norm.replace(word, "")
        target_norm = target_norm.strip()
        
        # 1. Try to find by name match
        for prop in properties:
            name = prop.get("name", "").lower()
            if target_norm in name or (len(target_norm) > 3 and target_norm[:5] in name):
                best_match = prop
                print(f"[SerpApi] Match found: {prop.get('name')}")
                break
        
        # 2. Heuristic: Primary Result
        if not best_match and data.get("rate_per_night"):
             best_match = data
             print(f"[SerpApi] Using knowledge graph result")
        
        # 3. Fallback to first property if results exist
        if not best_match and properties:
             best_match = properties[0]
             print(f"[SerpApi] Falling back to first property: {best_match.get('name')}")
             
        if not best_match: return None

        return {
            "price": self._extract_price(best_match),
            "currency": currency,
            "vendor": "SerpApi",
            "source": "SerpApi",
            "url": best_match.get("link", ""),
            "rating": best_match.get("overall_rating", best_match.get("rating", 0.0)),
            "reviews": best_match.get("reviews", 0),
            "amenities": best_match.get("amenities", []),
            "sentiment_breakdown": best_match.get("reviews_breakdown", []),
            "photos": [p.get("thumbnail") for p in best_match.get("images", []) if p.get("thumbnail")]
        }

    def _extract_price(self, match: Dict[str, Any]) -> float:
        # Simplistic extraction for brevity; creates a clean float
        try:
            val = match.get("rate_per_night", {}).get("extracted_lowest")
            return float(val) if val else 0.0
        except: return 0.0
