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
        currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        
        params = {
            "engine": "google_hotels",
            "q": f"{hotel_name} {location}",
            "check_in_date": check_in.isoformat(),
            "check_out_date": check_out.isoformat(),
            "adults": adults,
            "currency": currency,
            "gl": "us",
            "hl": "en",
            "api_key": self._key_manager.current_key
        }
        
        # Currency Localization logic
        if currency == "TRY": params["gl"], params["hl"] = "tr", "tr"
        elif currency == "GBP": params["gl"] = "uk"
        elif currency == "EUR": params["gl"] = "fr"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.BASE_URL, params=params)
                
                # Quota Handling
                if self._is_quota_error(response):
                    if self._key_manager.rotate_key():
                        params["api_key"] = self._key_manager.current_key
                        response = await client.get(self.BASE_URL, params=params)
                    else:
                        print("[SerpApi] All keys exhausted.")
                        return None
                
                if response.status_code != 200:
                    return None
                    
                return self._parse_hotel_result(response.json(), hotel_name, currency)
                
        except Exception as e:
            print(f"[SerpApi] Error: {e}")
            return None

    def _is_quota_error(self, response: httpx.Response) -> bool:
        if response.status_code == 429: return True
        try:
            return "quota" in response.json().get("error", "").lower()
        except: return False

    def _parse_hotel_result(self, data: Dict[str, Any], target_hotel: str, currency: str) -> Optional[Dict[str, Any]]:
        # This parsing logic matches the original client's heuristic
        properties = data.get("properties", [])
        best_match = None
        
        # ... (simplified standard match logic)
        if not properties and data.get("rate_per_night"):
             # Direct Single Result
             best_match = data
        
        if not best_match and properties:
             best_match = properties[0] # Default to first for now
             
        if not best_match: return None

        return {
            "price": self._extract_price(best_match),
            "currency": currency,
            "source": "SerpApi",
            "url": best_match.get("link", ""),
            "rating": best_match.get("overall_rating", 0.0),
            "reviews": best_match.get("reviews", 0),
            "amenities": best_match.get("amenities", []),
            "sentiment_breakdown": best_match.get("reviews_breakdown", [])
        }

    def _extract_price(self, match: Dict[str, Any]) -> float:
        # Simplistic extraction for brevity; creates a clean float
        try:
            val = match.get("rate_per_night", {}).get("extracted_lowest")
            return float(val) if val else 0.0
        except: return 0.0
