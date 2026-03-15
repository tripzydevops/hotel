import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, cast
from uuid import UUID
from supabase import Client
from backend.models.schemas import ScanOptions
from backend.services.provider_factory import ProviderFactory

from backend.utils.room_normalizer import RoomTypeNormalizer


class ScraperAgent:
    """
    Agent responsible for high-speed data acquisition from SerpApi.
    2026 Strategy: Decoupled from monolith for independent scaling.
    """

    def __init__(self, db: Client):
        self.db = db
        self._log_buffer = {}

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

    async def _check_global_cache(
        self, serp_api_id: str, check_in_date: date, requested_room_type: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        [Global Pulse] Checks if ANY user has scanned this hotel for this date
        in the last 12 hours. If a cached result exists and the user requested
        a specific room type, we attempt to extract that room's price from
        the cached room_types array instead of returning just the base price.
        """
        if not serp_api_id:
            return None

        try:
            # Look for a fresh pulse (recorded in last 720 mins / 12 hours)
            # KAİZEN: 12-Hour Pulse Strategy
            # Since scans reflect 12h intervals, a 12h cache allows User B 
            # to reuse User A's result even if they are offset by several hours.
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=720)).isoformat()

            res = (
                self.db.table("price_logs")
                .select("*")
                .eq("serp_api_id", serp_api_id)
                .eq("check_in_date", str(check_in_date))
                .gte("recorded_at", cutoff)
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
            )

            if res.data:
                cache = res.data[0]
                print(f"[GlobalPulse] Cache HIT for {serp_api_id} on {check_in_date}")

                # EXPLANATION: [Global Pulse Phase 2] — Feature C: Room-Type-Aware Matching
                # If the user requested a specific room type (e.g., "Deluxe"),
                # we search the cached room_types array for a matching entry.
                # This avoids a fresh API call when the data already exists.
                price_val = cache.get("price")
                final_price = float(price_val) if price_val is not None else 0.0
                final_currency = str(cache.get("currency") or "TRY")
                matched_room = None

                cached_rooms_raw = cache.get("room_types")
                cached_rooms = list(cast(list, cached_rooms_raw)) if isinstance(cached_rooms_raw, (list, tuple)) else []
                if requested_room_type and cached_rooms:
                    normalized_request = self._normalize_room_type(requested_room_type)
                    for room in cached_rooms:
                        if not isinstance(room, dict): continue
                        room_name = str(room.get("name") or "")
                        normalized_cached = self._normalize_room_type(room_name)
                        if (
                            normalized_request == normalized_cached
                            or normalized_request in normalized_cached
                        ):
                            matched_room = room
                            room_price = room.get("price")
                            if room_price is not None:
                                final_price = float(room_price)
                            
                            room_curr = room.get("currency")
                            if room_curr is not None:
                                final_currency = str(room_curr)

                            print(
                                f"[GlobalPulse] Room match: '{requested_room_type}' → '{room_name}' @ {final_price}"
                            )
                            break

                # Reconstruct the price_data object to mimic SerpApi response
                return {
                    "price": final_price,
                    "currency": final_currency,
                    "vendor": str(cache.get("vendor") or "Unknown"),
                    "source": "global_cache",
                    "offers": cache.get("parity_offers") or cache.get("offers") or [],
                    "room_types": cached_rooms,
                    "search_rank": cache.get("search_rank"),
                    "property_token": serp_api_id,
                    "status": "success",
                    "is_cached": True,
                    "matched_room_type": str(matched_room.get("name") or "Unknown")
                    if isinstance(matched_room, dict)
                    else None,
                }
        except Exception as e:
            print(f"[GlobalPulse] Cache lookup error: {e}")

        return None

    async def log_reasoning(
        self,
        session_id: Optional[UUID],
        step: str,
        message: str,
        level: str = "info",
        metadata: Optional[Dict] = None,
    ):
        """Buffer a log entry in memory for batch processing later."""
        if not session_id:
            return

        if not hasattr(self, "_log_buffer"):
            self._log_buffer = {}

        sid_key = str(session_id)
        if sid_key not in self._log_buffer:
            self._log_buffer[sid_key] = []

        entry = {
            "step": step,
            "level": level,
            "message": message,
            "timestamp": datetime.now().timestamp(),
            "metadata": metadata or {},
        }
        self._log_buffer[sid_key].append(entry)

    async def _flush_logs(self, session_id: UUID):
        """Batch update the reasoning trace to the database in a single round-trip."""
        if not session_id or not hasattr(self, "_log_buffer"):
            return

        sid_key = str(session_id)
        if sid_key not in self._log_buffer or not self._log_buffer[sid_key]:
            return

        try:
            # HYPERSPEED KAIZEN: Single atomic append instead of n+1 reads
            res = (
                self.db.table("scan_sessions")
                .select("reasoning_trace")
                .eq("id", sid_key)
                .execute()
            )
            
            raw_trace = []
            if res.data:
                db_trace = res.data[0].get("reasoning_trace")
                if isinstance(db_trace, list):
                    raw_trace = db_trace
            
            raw_trace.extend(self._log_buffer[sid_key])

            self.db.table("scan_sessions").update(
                {
                    "reasoning_trace": raw_trace,
                    "updated_at": datetime.now().isoformat(),
                }
            ).eq("id", sid_key).execute()

            # Clear buffer for this session
            self._log_buffer[sid_key] = []
        except Exception as e:
            print(f"[ScraperAgent] Log flush failed: {e}")

    async def run_scan(
        self,
        user_id: UUID,
        hotels: List[Dict[str, Any]],
        options: Optional[ScanOptions],
        session_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Performs the actual scraping for a list of hotels."""
        results = []
        semaphore = asyncio.Semaphore(10)  # Max 10 concurrent requests

        # [Reasoning] Start
        await self.log_reasoning(
            session_id,
            "Initialization",
            f"Starting scan for {len(hotels)} hotels",
            "info",
            {"hotel_count": len(hotels)},
        )

        if session_id:
            try:
                self.db.table("scan_sessions").update({"status": "running"}).eq(
                    "id", str(session_id)
                ).execute()
            except Exception as e:
                print(f"[ScraperAgent] Error updating session: {e}")

        async def fetch_hotel(hotel_raw: Any):
            if not isinstance(hotel_raw, dict): return
            hotel = cast(Dict[str, Any], hotel_raw)
            hotel_name = str(hotel.get("name") or "Unknown Hotel")
            try:
                async with semaphore:
                    # [Reasoning] Lock entry
                    await self.log_reasoning(
                        session_id, "Resource", f"Semaphore lock acquired for {hotel_name}. slot: {semaphore._value}", "info"
                    )
                    
                    hotel_id = hotel["id"]
                    location = hotel.get("location")
                    serp_api_id = hotel.get("serp_api_id")

                    # [Reasoning] Processing Hotel
                    await self.log_reasoning(
                        session_id, "Scraping", f"Processing {hotel_name}...", "info"
                    )

                    # Determine search parameters
                    check_in_raw = None
                    if options and options.check_in:
                        check_in_raw = options.check_in
                    else:
                        check_in_raw = hotel.get("fixed_check_in")

                    check_out_raw = None
                    if options and options.check_out:
                        check_out_raw = options.check_out
                    else:
                        check_out_raw = hotel.get("fixed_check_out")

                    # Normalize Dates
                    check_in = None
                    if isinstance(check_in_raw, str) and check_in_raw:
                        try:
                            check_in = datetime.strptime(
                                check_in_raw, "%Y-%m-%d"
                            ).date()
                        except ValueError:
                            check_in = None
                    elif isinstance(check_in_raw, date):
                        check_in = check_in_raw

                    check_out = None
                    if isinstance(check_out_raw, str) and check_out_raw:
                        try:
                            check_out = datetime.strptime(
                                check_out_raw, "%Y-%m-%d"
                            ).date()
                        except ValueError:
                            check_out = None
                    elif isinstance(check_out_raw, date):
                        check_out = check_out_raw
                    
                    # Ensure they aren't unassociated even if all checks fail
                    if check_in is None: check_in = None
                    if check_out is None: check_out = None

                    adults = 2
                    if options and options.adults:
                        adults = options.adults
                    else:
                        adults = hotel.get("default_adults") or 2
                

                    # Fallback: Auto-generate dates if not provided
                    if not check_in or not check_out:
                        from datetime import timedelta

                        today = date.today()
                        check_in = today + timedelta(days=1)
                        check_out = today + timedelta(days=2)
                        await self.log_reasoning(
                            session_id,
                            "Date Generation",
                            f"Auto-generated dates for {hotel_name}: {check_in} to {check_out}",
                            "info",
                            {"check_in": str(check_in), "check_out": str(check_out)},
                        )

                    price_data = None
                    try:
                        # 1. Check Global Pulse Cache first
                        await self.log_reasoning(
                            session_id, "Cache", f"Checking shared pulse for {serp_api_id} on {check_in}...", "info"
                        )
                        if isinstance(check_in, date):
                            price_data = await self._check_global_cache(
                                str(serp_api_id), check_in
                            )
                        else:
                            price_data = None

                        if price_data:
                            # KAİZEN: ID Sanitization
                            # Sanitize cached data to ensure it doesn't leak IDs from other users
                            price_data.pop("hotel_id", None)
                            price_data.pop("id", None)
                            await self.log_reasoning(
                                session_id,
                                "Cache HIT",
                                f"Using shared global pulse for {hotel_name} (Scanned by another user recently)",
                                "info",
                            )
                        else:
                            # 2. Fetch fresh price with SerpApi
                            primary_provider = ProviderFactory.get_provider()
                            await self.log_reasoning(
                                session_id,
                                "API Call",
                                f"Fetching price for {hotel_name} via {primary_provider.get_provider_name()}...",
                                "info",
                                {"provider": primary_provider.get_provider_name()},
                            )

                            # KAİZEN: Per-Request Timeout
                            # We wrap the provider call in a timeout to ensure a single stalling
                            # request doesn't block the entire background process.
                            try:
                                price_data = await asyncio.wait_for(
                                    primary_provider.fetch_price(
                                        hotel_name=hotel_name,
                                        location=location,
                                        check_in=check_in,
                                        check_out=check_out,
                                        adults=adults,
                                        currency=options.currency
                                        if options and options.currency
                                        else "TRY",
                                        serp_api_id=serp_api_id,
                                    ),
                                    timeout=60.0,
                                )
                                if price_data and price_data.get("price"):
                                    await self.log_reasoning(
                                        session_id,
                                        "Ingestion",
                                        f"Successfully extracted {price_data['price']} {price_data.get('currency')} for {hotel_name}.",
                                        "success",
                                    )
                            except asyncio.TimeoutError:
                                await self.log_reasoning(
                                    session_id,
                                    "Timeout",
                                    f"Request for {hotel_name} timed out after 60s.",
                                    "warning",
                                )
                                price_data = {
                                    "status": "error",
                                    "error": "request_timeout",
                                }
                    except Exception as e:
                        err_msg = str(e)
                        await self.log_reasoning(
                            session_id,
                            "API Error",
                            f"Primary Provider Error for {hotel_name}: {err_msg}",
                            "error",
                            {"error_message": err_msg},
                        )
                        price_data = {"status": "error", "error": err_msg}
                        status = "error"  # Ensure status is set for Analyst

                    # [NEW] Normalize Room Types if present
                    if isinstance(price_data, dict) and price_data.get("room_types"):
                        normalized_rooms = []
                        # Type narrowing for Pyright
                        room_list = price_data["room_types"]
                        if isinstance(room_list, list):
                            for room in room_list:
                                # Expected format from provider: {"name": "...", "price": ..., "currency": ...}
                                if isinstance(room, dict):
                                    raw_name = str(room.get("name") or "Unknown")
                                    # [Safety] Robust check for normalizer response
                                    try:
                                        norm_res = RoomTypeNormalizer.normalize(raw_name)

                                        if isinstance(norm_res, dict):
                                            room["canonical_code"] = norm_res.get("canonical_code", "unknown")
                                            room["canonical_name"] = norm_res.get("canonical_name", "Unknown")
                                    except Exception:
                                        pass
                                    normalized_rooms.append(room)

                            price_data["room_types"] = normalized_rooms
                            await self.log_reasoning(
                                session_id,
                                "Normalization",
                                f"Mapped {len(normalized_rooms)} room variants to canonical types for {hotel_name}.",
                                "info",
                            )
                        # Also normalize offers/parity_offers if they have room names?
                        # Providers usually put specific room names in 'room_types' array.

                    status = (
                        "success"
                        if price_data and price_data.get("status") != "error"
                        else "error"
                    )
                    if price_data and "error" in price_data:
                        status = "error"

                result = {
                    "hotel_id": hotel_id,
                    "hotel_name": hotel_name,
                    "location": location,
                    "status": status,
                    "price_data": price_data,
                    "check_in": check_in,
                    "adults": adults,
                }

                results.append(result)
                return result

            except Exception as e:
                print(f"[ScraperAgent] Critical Error processing {hotel_name}: {e}")
                error_result = {
                    "hotel_id": hotel["id"],
                    "hotel_name": hotel_name,
                    "status": "error",
                    "error": str(e),
                }
                results.append(error_result)
                return error_result

        # Run all hotels in parallel with semaphore control
        await asyncio.gather(*(fetch_hotel(h) for h in hotels))

        # HYPERSPEED: Batch flush all reasoning logs
        # EXPLANATION: Single Source of Truth Architecture
        # We previously experienced database collisions because both Scraper
        # and Analyst were writing to price_logs. We have removed the
        # _flush_price_logs call here. The AnalystAgent is now the
        # sole writer of price data, ensuring consistency and
        # resolving the "PARTIAL" scan status issue.
        if session_id:
            await self._flush_logs(session_id)

        return results
