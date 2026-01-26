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
from typing import Optional, List, Dict, Any
from datetime import date, timedelta, datetime
from dotenv import load_dotenv
import threading

load_dotenv()
load_dotenv(".env.local", override=True)

SERPAPI_BASE_URL = "https://serpapi.com/search"

# Load multiple API keys from environment
# Primary key: SERPAPI_API_KEY
# Secondary keys: SERPAPI_API_KEY_2, SERPAPI_API_KEY_3, etc.

def load_api_keys() -> List[str]:
    """Load all available SerpApi keys from environment."""
    keys = []
    
    # Primary key
    primary = os.getenv("SERPAPI_API_KEY")
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
        # Allow empty keys for initialization (will fail on usage)
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
        """
        Mark current key as exhausted and rotate to next available key.
        
        Returns:
            True if successfully rotated, False if all keys exhausted
        """
        with self._lock:
            if not self._keys:
                return False

            current_key = self._keys[self._current_index]

            
            # Try to find next available key
            attempts = 0
            while attempts < len(self._keys):
                self._current_index = (self._current_index + 1) % len(self._keys)
                next_key = self._keys[self._current_index]
                
                # Check if this key is still in cooldown
                if next_key in self._exhausted_keys:
                    exhaust_time = self._exhausted_keys[next_key]
                    if datetime.now() - exhaust_time > self._exhaustion_cooldown:
                        # Cooldown expired, key is available again
                        del self._exhausted_keys[next_key]
                        print(f"[SerpApi] Rotated to key {self._current_index + 1}/{len(self._keys)} (cooldown expired)")
                        return True
                else:
                    # Key is not exhausted
                    print(f"[SerpApi] Rotated to key {self._current_index + 1}/{len(self._keys)}")
                    return True
                
                attempts += 1
            
            print("[SerpApi] WARNING: All API keys are exhausted!")
            return False
    
    def reset_all(self):
        """Reset all keys (e.g., at start of new billing period)."""
        with self._lock:
            self._exhausted_keys.clear()
            self._current_index = 0
            print("[SerpApi] All keys reset to active status")
    
    def reload_keys(self, new_keys: List[str]):
        """Reload API keys (e.g., after environment update)."""
        with self._lock:
            self._keys = new_keys or []
            self._current_index = 0
            self._exhausted_keys.clear()
            print(f"[SerpApi] Reloaded keys. Total: {len(self._keys)}")

    def get_status(self) -> Dict[str, Any]:
        """Get current status of all API keys."""
        with self._lock:
            # Handle empty keys gracefully
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
            print("[SerpApi] WARNING: No API keys found in environment. Usage will fail until keys are added.")
        
        self._key_manager = ApiKeyManager(keys)
        print(f"[SerpApi] Initialized with {self._key_manager.total_keys} API key(s)")

    
    def reload(self):
        """Force reload keys from environment."""
        try:
            # Re-import to ensure we see fresh env vars if something weird is happening
            import os
            
            keys = load_api_keys()
            self._key_manager.reload_keys(keys)
            print(f"[SerpApi] Reloaded from environment: {len(keys)} keys found")
            return {
                "status": "success",
                "total_keys": len(keys),
                "keys_found": [str(k)[:4] + "..." for k in keys if k], # Safe string conversion
                "env_debug": {
                    "SERPAPI_API_KEY_EXISTS": bool(os.getenv("SERPAPI_API_KEY")),
                    "SERPAPI_API_KEY_VAL_LEN": len(os.getenv("SERPAPI_API_KEY") or "")
                }
            }
        except Exception as e:
            print(f"[SerpApi] Reload crash: {e}")
            return {
                "status": "error",
                "error": str(e),
                "total_keys": 0,
                "keys_found": []
            }

    @property
    def api_key(self) -> str:
        """Get current active API key."""
        return self._key_manager.current_key
    
    def get_key_status(self) -> Dict[str, Any]:
        """Get status of all API keys. Refreshes from ENV to handle serverless cold starts."""
        # Force reload from env to ensure we see current vars
        current_keys = load_api_keys()
        if len(current_keys) != self._key_manager.total_keys:
             self._key_manager.reload_keys(current_keys)
             
        status = self._key_manager.get_status()
        # Add debugging info about what was checked
        status["debug_env_check"] = {
            "SERPAPI_API_KEY": "FOUND" if os.getenv("SERPAPI_API_KEY") else "MISSING",
            "SERPAPI_API_KEY_2": "FOUND" if os.getenv("SERPAPI_API_KEY_2") else "MISSING",
            "cwd": os.getcwd()
        }
        return status

    def _normalize_string(self, text: Optional[str]) -> str:
        """Normalize string to Title Case and strip whitespace."""
        if not text:
            return ""
        return " ".join(word.capitalize() for word in text.split())

    def _clean_hotel_name(self, name: str) -> str:
        """
        Clean hotel name by removing promotional noise often found in SerpApi results.
        e.g. "Ramada by Wyndham - Best Price Guaranteed" -> "Ramada By Wyndham"
        """
        if not name:
            return ""
            
        cleaned = name.split(" - ")[0] # Split by dash
        cleaned = cleaned.split(" | ")[0] # Split by pipe
        cleaned = cleaned.split(" (")[0] # Remove parentheticals
        
        # Remove common marketing phrases
        phrases_to_remove = [
            "Best Price Guaranteed",
            "Special Offer",
            "Official Site",
            "Low Price",
            "Book Now",
            "Free Cancellation"
        ]
        
        for phrase in phrases_to_remove:
            # Case insensitive replacement
            import re
            cleaned = re.sub(re.escape(phrase), "", cleaned, flags=re.IGNORECASE).strip()
            
        return self._normalize_string(cleaned)
    
    def _is_quota_error(self, response: httpx.Response) -> bool:
        """Check if response indicates quota exhaustion."""
        if response.status_code == 429:
            return True
        
        # Some APIs return 200 with error in body
        try:
            data = response.json()
            error = data.get("error", "").lower()
            if "quota" in error or "limit" in error or "exceeded" in error:
                return True
        except:
            pass
        
        return False
    
    async def search_hotels(self, query: str) -> List[Dict[str, Any]]:
        """
        Broad search for hotels to support autocomplete/discovery.
        """
        params = {
            "engine": "google_hotels",
            "q": query,
            "gl": "us",
            "hl": "en",
            "api_key": self.api_key,
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(SERPAPI_BASE_URL, params=params)
                
                # Check for quota exhaustion
                if self._is_quota_error(response):
                    if self._key_manager.rotate_key("quota_exhausted"):
                        # Retry with new key
                        params["api_key"] = self.api_key
                        response = await client.get(SERPAPI_BASE_URL, params=params)
                    else:
                        print("[SerpApi] All keys exhausted, cannot retry")
                        return []
                
                response.raise_for_status()
                data = response.json()
                
                properties = data.get("properties", [])
                
                results = []
                for prop in properties[:5]: # Top 5 only
                    results.append({
                        "name": self._clean_hotel_name(prop.get("name", "")),
                        "location": prop.get("description", "Unknown Location"), 
                        "serp_api_id": prop.get("hotel_id") or prop.get("property_token"),
                        "source": "serpapi"
                    })
                return results
        except Exception as e:
            print(f"[SerpApi] Search Error: {e}")
            return []
    
    async def fetch_hotel_price(
        self,
        hotel_name: str,
        location: str,
        check_in: Optional[date] = None,
        check_out: Optional[date] = None,
        adults: int = 2,
        currency: str = "USD",
        serp_api_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch price for a specific hotel.
        
        Args:
            hotel_name: Name of the hotel to search
            location: City/region for the search
            check_in: Check-in date (defaults to tonight)
            check_out: Check-out date (defaults to tomorrow)
            adults: Number of adults (defaults to 2)
            currency: Preferred currency
            serp_api_id: ID to match against properties (optional)
        
        Returns:
            Dict with price info or None if not found
        """
        # Default to tonight/tomorrow if not specified
        if not check_in:
            check_in = date.today()
        if not check_out:
            check_out = check_in + timedelta(days=1)
        
        # Normalize inputs for consistency
        hotel_name = self._normalize_string(hotel_name)
        location = self._normalize_string(location)
        
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
        
        # Optimization: Use direct ID if available
        if serp_api_id:
            print(f"[SerpApi] Optimizing search with Property Token: {serp_api_id}")
            params["property_token"] = serp_api_id
            # Ensure we don't conflict with q if utilizing token directly
            # params["q"] = hotel_name # Keep q just in case, or maybe remove it? 
            # Usually property_token takes precedence or filters q.
            # Based on user URL: &property_token=...&q=Willmont...
            # So we keep q.
        
        # Localization: Match country to currency for better results
        if currency == "TRY":
            params["gl"] = "tr"
            params["hl"] = "tr"
        elif currency == "GBP":
            params["gl"] = "uk"
        elif currency == "EUR":
            params["gl"] = "fr" # Generic EU
            
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(SERPAPI_BASE_URL, params=params)
                
                # Check for quota exhaustion and retry with next key
                if self._is_quota_error(response):
                    print(f"[SerpApi] Quota exhausted for key, rotating...")
                    if self._key_manager.rotate_key("quota_exhausted"):
                        params["api_key"] = self.api_key
                        response = await client.get(SERPAPI_BASE_URL, params=params)
                    else:
                        print("[SerpApi] All keys exhausted!")
                        return None
                
                response.raise_for_status()
                data = response.json()
                
                return self._parse_hotel_result(data, hotel_name, currency, serp_api_id)
                
        except httpx.HTTPError as e:
            print(f"[SerpApi] HTTP error fetching {hotel_name}: {e}")
            return None
        except Exception as e:
            print(f"[SerpApi] Error fetching {hotel_name}: {e}")
            return None
    
    
    def _parse_hotel_result(
        self, 
        data: Dict[str, Any], 
        target_hotel: str,
        default_currency: str = "USD",
        target_serp_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Parse SerpApi response to extract hotel price."""
        
        # Check for properties in response
        properties = data.get("properties", [])
        
        if not properties:
            # Check for Direct "Knowledge Graph" Result (Root level fields)
            # This happens for specific queries like "Willmont Hotel Balikesir"
            if data.get("search_parameters", {}).get("q") and (data.get("rate_per_night") or data.get("prices") or data.get("menu")):
                 print(f"[SerpApi] Detected Knowledge Graph Result for {target_hotel}")
                 # Construct a 'best_match' object from root fields
                 best_match = {
                     "name": data.get("name") or data.get("search_parameters", {}).get("q"),
                     "deal_description": "Direct",
                     "overall_rating": data.get("overall_rating"),
                     "extracted_hotel_class": data.get("extracted_hotel_class"),
                     "property_token": data.get("property_token"),
                     "images": data.get("images", []),
                     "amenities": data.get("amenities", []),
                     "prices": data.get("prices", []),
                     "description": data.get("description"),
                     "rate_per_night": data.get("rate_per_night")
                 }
                 
                 # If rate_per_night is at root but not in prices list
                 if not best_match["prices"] and data.get("rate_per_night"):
                      best_match["prices"] = [{"rate_per_night": data.get("rate_per_night"), "source": "Official"}]

            else:
                # Try alternative response structure (older format)
                properties = data.get("organic_results", [])
                
        if not properties and not best_match:
            print(f"[SerpApi] No properties found for {target_hotel}")
            # Try to return partial ANYWAY from root if name matches loosely
            if data.get("name") and target_hotel.lower() in data.get("name", "").lower():
                 print(f"[SerpApi] Using root data as fallback for {target_hotel}")
                 best_match = data
            else:
                 return None
        
        # Find the best matching hotel (if not already found via knowledge graph)
        if not best_match:
            # Find the best matching hotel
            target_lower = target_hotel.lower()
            best_match = None
        
        # Prio 0: Look for exact ID match first
        if target_serp_id:
            for prop in properties:
                if str(prop.get("hotel_id")) == str(target_serp_id) or prop.get("property_token") == target_serp_id:
                    best_match = prop
                    break
        
        # Prio 1: Fuzzy Name Matching
        if not best_match:
            # Simple Jaccard similarity for better accuracy than pure word count
            # words = set(target_lower.split())
            best_score = 0.0
            
            for prop in properties:
                name = prop.get("name", "").lower()
                
                # Check for direct inclusion
                if target_lower in name:
                    best_match = prop
                    break
                
                # Calculate intersection over union of words
                target_words = set(target_lower.split())
                prop_words = set(name.split())
                
                if not target_words or not prop_words:
                    continue
                    
                intersection = len(target_words.intersection(prop_words))
                union = len(target_words.union(prop_words))
                score = intersection / union if union > 0 else 0
                
                # Boost score if location also matches (if available in prop)
                # But properties usually just have 'name'
                
                if score > best_score and score > 0.3: # Threshold
                    best_score = score
                    best_match = prop
        
        if not best_match:
            # Fall back to first result if it seems relevant enough (optional)
            # For now, let's pick the first one if the query was specific enough
            print(f"[SerpApi] No confident match for {target_hotel}. Using first result.")
            best_match = properties[0]
        
        # Extract price and currency
        price = None
        currency = default_currency
        
        # Try different price fields
        if "rate_per_night" in best_match:
            rate = best_match["rate_per_night"]
            if isinstance(rate, dict):
                # Prefer extracted numeric value, otherwise handle text
                price = rate.get("extracted_lowest", rate.get("lowest"))
            else:
                price = rate
        elif "price" in best_match:
            price = best_match["price"]
        elif "prices" in best_match and best_match["prices"]:
            # Check price sources
            price_obj = best_match["prices"][0]
            rate = price_obj.get("rate_per_night", {})
            if isinstance(rate, dict):
                price = rate.get("extracted_lowest", rate.get("lowest"))
            else:
                price = rate
                
        # Clean up price if it's a string, removing currency codes like "TRY" or symbols
        if isinstance(price, str):
            import re
            # Remove currency codes and whitespace
            # Keep digits, dot, comma
            clean_str = re.sub(r'[^\d.,]', '', price)
            
            # Heuristic Parsing for International Formats
            # Case A: 1.234,56 (EU/TR style) -> 1234.56
            # Case B: 1,234.56 (US/UK style) -> 1234.56
            # Case C: 1.234 (EU/TR thousands) -> 1234
            # Case D: 1,234 (US/UK thousands) -> 1234
            
            if "," in clean_str and "." in clean_str:
                last_comma = clean_str.rfind(",")
                last_dot = clean_str.rfind(".")
                
                if last_comma > last_dot:
                    # Case A: Dot is thousands, Comma is decimal
                    clean_str = clean_str.replace(".", "").replace(",", ".")
                else:
                    # Case B: Comma is thousands, Dot is decimal
                    clean_str = clean_str.replace(",", "")
            elif "," in clean_str:
                # Ambiguous: 1,234 Could be 1.234 (decimal) or 1234 (thousands)
                # Usually SerpApi returns integers for high values without decimals if exact
                # But prices > 999 usually use thousands separator.
                # If it has 3 digits after comma, it's likely thousands (1,000)
                # If it has 2 digits, likely decimal (1,50) - though rarely used with comma alone in US
                
                parts = clean_str.split(",")
                if len(parts[-1]) == 3 and len(parts) > 1:
                     # Assume thousands
                     clean_str = clean_str.replace(",", "")
                else:
                     # Assume decimal (replace with dot)
                     clean_str = clean_str.replace(",", ".")
            elif "." in clean_str:
                # Ambiguous: 1.234 Could be 1234 (thousands TR) or 1.234 (decimal US)
                # Same logic: 3 digits after dot -> likely thousands in TR context if currency is TRY/EUR
                parts = clean_str.split(".")
                if len(parts[-1]) == 3 and len(parts) > 1:
                     # Check currency to hint
                     if currency in ["TRY", "EUR", "IDR", "VND"]:
                         clean_str = clean_str.replace(".", "")
                     else:
                         pass # Assume decimal for USD/GBP
            
            try:
                price = float(clean_str)
            except ValueError:
                print(f"[SerpApi] Failed to parse price string: {price}")
                price = None
        
        if price is None:
            print(f"[SerpApi] Could not extract price for {target_hotel}, returning partial data.")
            # return None -> Don't return None! Return partial data.
        
        return {
            "hotel_name": self._clean_hotel_name(best_match.get("name", target_hotel)),
            "price": float(price) if price is not None else None,
            "currency": currency,
            "source": "serpapi",
            "vendor": best_match.get("deal_description", "Unknown Vendor"), # e.g. "Booking.com"
            "rating": best_match.get("overall_rating"), # e.g. 4.5
            "stars": best_match.get("extracted_hotel_class"), # e.g. 5
            "property_token": best_match.get("property_token"), # Unique ID
            "image_url": best_match.get("images", [{}])[0].get("thumbnail"), # First image
            
            # Rich Data Fields
            "amenities": best_match.get("amenities", []),
            "images": [
                {"thumbnail": img.get("thumbnail"), "original": img.get("original")} 
                for img in best_match.get("images", [])[:10]
            ],
            "offers": [
                {
                    "vendor": p.get("source"),
                    "price": p.get("rate_per_night", {}).get("lowest") if isinstance(p.get("rate_per_night"), dict) else p.get("rate_per_night")
                }
                for p in best_match.get("prices", [])
            ],
            # Room types are tricky in basic hotel search, usually requires deep search.
            # We capture what we can from 'options' if available in this endpoint (rare) or raw data.
            "room_types": [], 
            
            "raw_data": best_match,
        }
    
    async def fetch_multiple_hotels(
        self,
        hotels: List[Dict[str, str]],
        check_in: Optional[date] = None,
        check_out: Optional[date] = None,
        currency: str = "USD"
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Fetch prices for multiple hotels.
        
        Args:
            hotels: List of dicts with 'name' and 'location' keys
            check_in: Check-in date
            check_out: Check-out date
        
        Returns:
            Dict mapping hotel names to their price data
        """
        results = {}
        
        for hotel in hotels:
            name = hotel.get("name", "")
            location = hotel.get("location", "")
            
            if not name:
                continue
            
            result = await self.fetch_hotel_price(
                hotel_name=name,
                location=location,
                check_in=check_in,
                check_out=check_out,
                currency=currency
            )
            
            results[name] = result
        
        return results


# Singleton instance
serpapi_client = SerpApiClient()
