
import asyncio
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from supabase import Client
from backend.models.schemas import ScanOptions
from backend.services.provider_factory import ProviderFactory

from backend.utils.helpers import log_query
from backend.utils.room_normalizer import RoomTypeNormalizer

class ScraperAgent:
    """
    Agent responsible for high-speed data acquisition from SerpApi.
    2026 Strategy: Decoupled from monolith for independent scaling.
    """
    def __init__(self, db: Client):
        self.db = db

    # EXPLANATION: [Global Pulse Phase 2] — Feature C: Room Type Normalization Map
    # Turkish hotel systems often use localized room names. This map allows
    # the cache to match "Standart Oda" → "Standard" so User B tracking
    # "Standard Room" can reuse User A's cached result that has "Standart Oda".
    ROOM_TYPE_NORMALIZE_MAP = {
        "standart": "standard",
        "standart oda": "standard",
        "standart oda (çift kişilik)": "standard double",
        "standart tek": "standard single",
        "standart çift": "standard double",
        "superior": "superior",
        "süit": "suite",
        "suit": "suite",
        "aile odası": "family room",
        "aile": "family room",
        "delüks": "deluxe",
        "ekonomi": "economy",
        "tek kişilik": "single",
        "çift kişilik": "double",
        "üç kişilik": "triple",
        "kral dairesi": "king suite",
        "penthouse": "penthouse",
    }

    def _normalize_room_type(self, name: str) -> str:
        """
        [Global Pulse Phase 2] — Room Type Normalizer
        Converts Turkish or variant room names to a canonical English form.
        Used by _check_global_cache to match room types across users.
        """
        if not name:
            return ""
        lowered = name.strip().lower()
        # Check direct match first
        if lowered in self.ROOM_TYPE_NORMALIZE_MAP:
            return self.ROOM_TYPE_NORMALIZE_MAP[lowered]
        # Check partial match (e.g., "Standart Tek Kişilik Oda" contains "standart tek")
        for turkish, english in self.ROOM_TYPE_NORMALIZE_MAP.items():
            if turkish in lowered:
                return english
        return lowered  # Return original lowered if no match

    async def _check_global_cache(self, serp_api_id: str, check_in_date: date, requested_room_type: str = None) -> Optional[Dict[str, Any]]:
        """
        [Global Pulse] Checks if ANY user has scanned this hotel for this date
        in the last 3 hours. If a cached result exists and the user requested
        a specific room type, we attempt to extract that room's price from
        the cached room_types array instead of returning just the base price.
        """
        if not serp_api_id:
            return None
            
        try:
            # Look for a fresh pulse (recorded in last 180 mins / 3 hours)
            cutoff = (datetime.now() - timedelta(minutes=180)).isoformat()
            
            res = self.db.table("price_logs") \
                .select("*") \
                .eq("serp_api_id", serp_api_id) \
                .eq("check_in_date", str(check_in_date)) \
                .gte("recorded_at", cutoff) \
                .order("recorded_at", desc=True) \
                .limit(1) \
                .execute()
            
            if res.data:
                cache = res.data[0]
                print(f"[GlobalPulse] Cache HIT for {serp_api_id} on {check_in_date}")

                # EXPLANATION: [Global Pulse Phase 2] — Feature C: Room-Type-Aware Matching
                # If the user requested a specific room type (e.g., "Deluxe"),
                # we search the cached room_types array for a matching entry.
                # This avoids a fresh API call when the data already exists.
                final_price = cache["price"]
                final_currency = cache["currency"]
                matched_room = None

                cached_rooms = cache.get("room_types") or []
                if requested_room_type and cached_rooms:
                    normalized_request = self._normalize_room_type(requested_room_type)
                    for room in cached_rooms:
                        room_name = room.get("name", "")
                        normalized_cached = self._normalize_room_type(room_name)
                        if normalized_request == normalized_cached or normalized_request in normalized_cached:
                            matched_room = room
                            final_price = room.get("price", final_price)
                            final_currency = room.get("currency", final_currency)
                            print(f"[GlobalPulse] Room match: '{requested_room_type}' → '{room_name}' @ {final_price}")
                            break

                # Reconstruct the price_data object to mimic SerpApi response
                return {
                    "price": final_price,
                    "currency": final_currency,
                    "vendor": cache["vendor"],
                    "source": "global_cache",
                    "offers": cache.get("parity_offers") or cache.get("offers") or [],
                    "room_types": cached_rooms,
                    "search_rank": cache.get("search_rank"),
                    "property_token": serp_api_id,
                    "status": "success",
                    "is_cached": True,
                    "matched_room_type": matched_room.get("name") if matched_room else None
                }
        except Exception as e:
            print(f"[GlobalPulse] Cache lookup error: {e}")
            
        return None

    async def log_reasoning(self, session_id: UUID, step: str, message: str, level: str = "info", metadata: Optional[Dict] = None):
        """Append a structured log to the session's reasoning trace."""
        if not session_id:
            return
            
        try:
            entry = {
                "step": step,
                "level": level,
                "message": message,
                "timestamp": datetime.now().timestamp(),
                "metadata": metadata or {}
            }
            
            # ATOMIC KAİZEN: Re-fetch inside the log call to minimize race window
            # In high-concurrency we'd use a queue, but for 5-10 hotels this is acceptable.
            res = self.db.table("scan_sessions").select("reasoning_trace").eq("id", str(session_id)).execute()
            if res.data:
                current_trace = res.data[0].get("reasoning_trace") or []
                current_trace.append(entry)
                
                self.db.table("scan_sessions").update({
                    "reasoning_trace": current_trace,
                    "updated_at": datetime.now().isoformat()
                }).eq("id", str(session_id)).execute()
            
        except Exception as e:
            print(f"[ScraperAgent] Logging failed: {e}")

    async def run_scan(
        self,
        user_id: UUID,
        hotels: List[Dict[str, Any]],
        options: Optional[ScanOptions],
        session_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Performs the actual scraping for a list of hotels."""
        results = []
        semaphore = asyncio.Semaphore(10) # Max 10 concurrent requests
        
        # [Reasoning] Start
        await self.log_reasoning(session_id, "Initialization", f"Starting scan for {len(hotels)} hotels", "info", {"hotel_count": len(hotels)})

        if session_id:
            try:
                self.db.table("scan_sessions").update({"status": "running"}).eq("id", str(session_id)).execute()
            except Exception as e:
                print(f"[ScraperAgent] Error updating session: {e}")

        async def fetch_hotel(hotel):
            hotel_name = hotel["name"]
            try:
                async with semaphore:
                    hotel_id = hotel["id"]
                    location = hotel.get("location")
                    serp_api_id = hotel.get("serp_api_id")
                    
                    # [Reasoning] Processing Hotel
                    await self.log_reasoning(session_id, "Scraping", f"Processing {hotel_name}...", "info")
                    
                    # Determine search parameters
                    check_in_raw = options.check_in if options and options.check_in else hotel.get("fixed_check_in")
                    check_out_raw = options.check_out if options and options.check_out else hotel.get("fixed_check_out")
                    
                    # Normalize Dates
                    check_in = check_in_raw
                    if isinstance(check_in_raw, str):
                        try:
                            check_in = datetime.strptime(check_in_raw, "%Y-%m-%d").date()
                        except ValueError:
                            check_in = None

                    check_out = check_out_raw
                    if isinstance(check_out_raw, str):
                        try:
                            check_out = datetime.strptime(check_out_raw, "%Y-%m-%d").date()
                        except ValueError:
                            check_out = None

                    adults = options.adults if options and options.adults else (hotel.get("default_adults") or 2)
                
                    # Fallback: Auto-generate dates if not provided
                    if not check_in or not check_out:
                        from datetime import timedelta
                        today = date.today()
                        check_in = today + timedelta(days=1)
                        check_out = today + timedelta(days=2)
                        await self.log_reasoning(session_id, "Date Generation", f"Auto-generated dates for {hotel_name}: {check_in} to {check_out}", "info", {"check_in": str(check_in), "check_out": str(check_out)})
                    
                    price_data = None
                    try:
                        # 1. Check Global Pulse Cache first
                        price_data = await self._check_global_cache(serp_api_id, check_in)
                        
                        if price_data:
                            # KAİZEN: ID Sanitization
                            # Sanitize cached data to ensure it doesn't leak IDs from other users
                            price_data.pop("hotel_id", None)
                            price_data.pop("id", None)
                            await self.log_reasoning(session_id, "Cache HIT", f"Using shared global pulse for {hotel_name} (Scanned by another user recently)", "info")
                        else:
                            # 2. Fetch fresh price with SerpApi
                            primary_provider = ProviderFactory.get_provider()
                            await self.log_reasoning(session_id, "API Call", f"Fetching price for {hotel_name} via {primary_provider.get_provider_name()}...", "info", {"provider": primary_provider.get_provider_name()})
                            
                            price_data = await primary_provider.fetch_price(
                                hotel_name=hotel_name,
                                location=location,
                                check_in=check_in,
                                check_out=check_out,
                                adults=adults,
                                currency=options.currency if options and options.currency else "TRY",
                                serp_api_id=serp_api_id
                            )
                    except Exception as e:
                        await self.log_reasoning(session_id, "API Error", f"Primary Provider Error for {hotel_name}: {e}", "error", {"error_message": str(e)})
                    
                    # [NEW] Normalize Room Types if present
                    if price_data and price_data.get("room_types"):
                        normalized_rooms = []
                        for room in price_data["room_types"]:
                            # Expected format from provider: {"name": "...", "price": ..., "currency": ...}
                            raw_name = room.get("name") or "Unknown"
                            norm_res = RoomTypeNormalizer.normalize(raw_name)
                            
                            # Enriched room object
                            room["canonical_code"] = norm_res["canonical_code"]
                            room["canonical_name"] = norm_res["canonical_name"]
                            normalized_rooms.append(room)
                        
                        price_data["room_types"] = normalized_rooms
                        # Also normalize offers/parity_offers if they have room names? 
                        # Providers usually put specific room names in 'room_types' array.
                    
                    status = "success" if price_data else "not_found"
                    if price_data and price_data.get("status") == "error":
                        status = price_data.get("error", "failed")

                    # Log query for history
                    await log_query(
                        db=self.db,
                        user_id=user_id,
                        hotel_name=hotel_name,
                        location=location,
                        action_type="monitor",
                        status=status,
                        price=price_data.get("price") if price_data else None,
                        currency=price_data.get("currency") if price_data else None,
                        vendor=price_data.get("vendor") if price_data else None,
                        session_id=session_id,
                        check_in=check_in,
                        adults=adults
                    )

                result = {
                    "hotel_id": hotel_id,
                    "hotel_name": hotel_name,
                    "location": location,
                    "status": status,
                    "price_data": price_data,
                    "check_in": check_in,
                    "adults": adults
                }

                results.append(result)
                return result

            except Exception as e:
                print(f"[ScraperAgent] Critical Error processing {hotel_name}: {e}")
                error_result = {
                    "hotel_id": hotel["id"],
                    "hotel_name": hotel_name,
                    "status": "error",
                    "error": str(e)
                }
                results.append(error_result)
                return error_result

        # Run all hotels in parallel with semaphore control
        await asyncio.gather(*(fetch_hotel(h) for h in hotels))
        return results
