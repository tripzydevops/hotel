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

    def rotate_key(self, mark_exhausted: bool = True) -> bool:
        with self._lock:
            if not self._keys: return False
            
            if mark_exhausted:
                current_key = self._keys[self._current_index]
                self._exhausted_keys[current_key] = datetime.now()
            
            # Simple rotation to next available (or least recently exhausted if all exhausted)
            attempts = 0
            original_index = self._current_index
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
            
            # If we reached here, all keys are technically exhausted. 
            # If we were told NOT to mark exhaustion, we just wrap around anyway (hope for transient fix)
            if not mark_exhausted:
                self._current_index = (original_index + 1) % len(self._keys)
                return True
                
            return False

    @property
    def current_key_index(self) -> int:
        with self._lock:
            return self._current_index

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

    def get_active_key_index(self) -> int:
        return self._key_manager.current_key_index

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
                        is_rate_limit = response.status_code == 429
                        print(f"[SerpApi] {'Rate limit' if is_rate_limit else 'Quota error'} on Key ...{current_key_suffix}")
                        
                        # Only mark as 'permanently' exhausted if it's a quota error (not 429)
                        if self._key_manager.rotate_key(mark_exhausted=not is_rate_limit):
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
                        return self._parse_hotel_result(data, hotel_name, currency, target_serp_id=token)
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
            error = response.json().get("error", "").lower()
            return any(x in error for x in ["quota", "limit", "exceeded"])
        except: return False

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
        seen_vendors = set()
        
        # Determine current target price to identify competitors correctly
        for p in prices_data:
            # Normalize vendor name
            vendor = p.get("source") or p.get("name") or p.get("deal_description") or "Unknown"
            if vendor in seen_vendors: continue
            
            # Extract price from various possible fields
            raw = p.get("rate_per_night", {}).get("lowest") if isinstance(p.get("rate_per_night"), dict) else p.get("rate_per_night")
            if not raw:
                 raw = p.get("price") or p.get("extracted_lowest")
            
            price = self._clean_price_string(raw, currency)
            if price and price > 0:
                offers.append({
                    "vendor": vendor,
                    "price": price,
                    "currency": currency
                })
                seen_vendors.add(vendor)
        
        # print(f"[SerpApi] Extracted {len(offers)} market offers")
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

    def _parse_hotel_result(self, data: Dict[str, Any], target_hotel: str, currency: str, target_serp_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        properties = data.get("properties", [])
        best_match = None
        
        # 0. Primary ID Match (Highest fidelity)
        if target_serp_id:
            for prop in properties:
                if str(prop.get("hotel_id")) == str(target_serp_id) or prop.get("property_token") == target_serp_id:
                    best_match = prop
                    print(f"[SerpApi] Exact ID match found: {prop.get('name')}")
                    break

        # 1. Knowledge Graph Result (if ID match failed)
        if not best_match and data.get("rate_per_night"):
             best_match = data
             print(f"[SerpApi] Using knowledge graph result")

        # 2. Fuzzy Name Match
        if not best_match:
            # Remove common stop words for fuzzy matching
            ignore = ["hotel", "resort", "spa", "residences", "by", "wyndham", "hilton", "garden", "inn", "&"]
            target_norm = target_hotel.lower()
            for word in ignore:
                target_norm = target_norm.replace(word, "")
            target_norm = target_norm.strip()
            
            for prop in properties:
                name = prop.get("name", "").lower()
                if target_norm in name or (len(target_norm) > 3 and target_norm[:5] in name):
                    best_match = prop
                    print(f"[SerpApi] Name match found: {prop.get('name')}")
                    break
        
        # 3. Fallback to first property if results exist
        if not best_match and properties:
             best_match = properties[0]
             print(f"[SerpApi] Falling back to first property: {best_match.get('name')}")
             
        if not best_match: return None

        # Extract Raw Price safely using the robust cleaner
        raw_price = None
        if "rate_per_night" in best_match:
            r = best_match["rate_per_night"]
            raw_price = r.get("extracted_lowest") if isinstance(r, dict) else r
        elif "price" in best_match: raw_price = best_match["price"]
        elif best_match.get("prices"):
            # Try to find a featured price or the first one
            r = best_match["prices"][0].get("rate_per_night", {})
            raw_price = r.get("extracted_lowest") if isinstance(r, dict) else r

        price = self._clean_price_string(raw_price, currency)

        # Build Offers List (Market intelligence)
        # SerpApi provides other vendors in 'prices' or 'featured_prices'
        offers_data = best_match.get("prices", []) or []
        if best_match.get("featured_prices"):
            offers_data.extend(best_match["featured_prices"])
        
        offers = self._parse_market_offers(offers_data, currency)
        if not offers:
            print(f"[SerpApi] WARNING: No offers found for {best_match.get('name')}. Prices key exists: {'prices' in best_match}, Featured key exists: {'featured_prices' in best_match}")
            
        return {
            "price": price or 0.0,
            "currency": currency,
            "vendor": best_match.get("deal_description") or best_match.get("source") or "SerpApi",
            "source": "SerpApi",
            "url": best_match.get("link", ""),
            "rating": best_match.get("overall_rating", best_match.get("rating", 0.0)),
            "reviews": int(best_match.get("reviews") or 0) if isinstance(best_match.get("reviews"), (int, float, str)) and str(best_match.get("reviews")).isdigit() else 0,
            "amenities": best_match.get("amenities", []),
            "property_token": best_match.get("property_token") or best_match.get("hotel_id"),
            "image_url": best_match.get("images", [{}])[0].get("thumbnail") if best_match.get("images") else None,
            "photos": [p.get("thumbnail") for p in best_match.get("images", []) if p.get("thumbnail")],
            "images": [{"thumbnail": i.get("thumbnail"), "original": i.get("original")} for i in best_match.get("images", [])[:10]],
            "offers": offers,
            "room_types": self._extract_all_room_types(best_match, currency),
            "reviews_breakdown": best_match.get("reviews_breakdown", []),
            "reviews_list": best_match.get("actual_reviews", []) if isinstance(best_match.get("actual_reviews"), list) else [],
            "raw_data": best_match
        }

    def _extract_price(self, match: Dict[str, Any]) -> float:
        val = match.get("rate_per_night", {}).get("extracted_lowest") if isinstance(match.get("rate_per_night"), dict) else match.get("rate_per_night")
        return self._clean_price_string(val, "USD") or 0.0
