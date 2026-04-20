import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from backend.models.schemas import ScanOptions
from backend.services.provider_factory import ProviderFactory
from backend.utils.room_normalizer import RoomTypeNormalizer
from supabase import Client


class ScraperAgent:
    """
    Agent responsible for data acquisition from SerpApi.
    """

    # Global Concurrency Control
    # This semaphore is shared across all instances of ScraperAgent in this process.
    # It ensures that even if we process multiple users in parallel, the total
    # number of concurrent SerpApi requests remains within safe limits.
    _global_semaphore = asyncio.Semaphore(15)

    def __init__(self, db: Client):
        self.db = db
        self._log_buffer = {}

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
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", sid_key).execute()

            self._log_buffer[sid_key] = []
        except Exception as e:
            print(f"[ScraperAgent] Log flush failed: {e}")

    async def _check_global_cache(
        self, serp_api_id: str, check_in: date
    ) -> Optional[Dict[str, Any]]:
        """
        Cross-User Shared Cache
        Searches price_logs for ANY hotel that shares the same serp_api_id.
        Verification logic: Data must be within 3 hours.
        """
        if not serp_api_id or serp_api_id == "None":
            return None

        try:
            # 1. Find all hotel IDs sharing this SerpApi ID
            hotels_res = (
                self.db.table("hotels")
                .select("id")
                .eq("serp_api_id", serp_api_id)
                .execute()
            )
            sharing_hotel_ids = [h["id"] for h in (hotels_res.data or [])]

            if not sharing_hotel_ids:
                return None

            # Check if anyone else has scanned this hotel in the last 3 hours.
            # This is our cross-user cache and pooling layer to handle duplicates.
            # Use UTC-aware datetime for comparison to prevent timezone drift.
            three_hours_ago = (
                datetime.now(timezone.utc) - timedelta(hours=3)
            ).isoformat()

            logs_res = (
                self.db.table("price_logs")
                .select(
                    "price, recorded_at, currency, room_types, vendor, parity_offers, metadata"
                )
                .in_("hotel_id", sharing_hotel_ids)
                .eq("check_in_date", check_in.isoformat())
                .gte("recorded_at", three_hours_ago)
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
            )

            if logs_res.data:
                log = logs_res.data[0]

                cached_rooms = log.get("room_types", [])
                cached_offers = log.get("parity_offers", [])

                # Bypass cache if it lacks deep data (rooms/offers).
                if not cached_rooms or not cached_offers:
                    return None

                print(f"[Cache Hit] {serp_api_id} on {check_in}")
                return {
                    "price": float(log["price"]),
                    "currency": log.get("currency", "USD"),
                    "status": "success",
                    "vendor": log.get("vendor"),
                    "offers": cached_offers,
                    "room_types": cached_rooms,
                    "metadata": log.get("metadata", {}),
                    "recorded_at": log["recorded_at"],
                    "source": "global_cache",
                }
        except Exception as e:
            print(f"[Cache] Lookup error: {e}")

        return None

    async def run_scan(
        self,
        user_id: UUID,
        hotels: List[Dict[str, Any]],
        options: Optional[ScanOptions],
        session_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Performs the actual scraping for a list of hotels."""
        results = []

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

        async def fetch_hotel(hotel: Dict[str, Any]):
            hotel_name = str(hotel.get("name") or "Unknown Hotel")
            hotel_id = hotel["id"]
            location = hotel.get("location")
            serp_api_id = hotel.get("serp_api_id")

            try:
                async with self._global_semaphore:
                    await self.log_reasoning(
                        session_id,
                        "Resource",
                        f"Processing {hotel_name} (SerpApi ID: {serp_api_id})",
                        "info",
                    )

                    # Determine dates
                    check_in_raw = (
                        options.check_in
                        if options and options.check_in
                        else hotel.get("fixed_check_in")
                    )
                    check_out_raw = (
                        options.check_out
                        if options and options.check_out
                        else hotel.get("fixed_check_out")
                    )

                    check_in: date = date.today() + timedelta(days=1)
                    check_out: date = date.today() + timedelta(days=2)

                    if isinstance(check_in_raw, str) and check_in_raw:
                        try:
                            check_in = datetime.strptime(
                                check_in_raw, "%Y-%m-%d"
                            ).date()
                        except Exception:
                            pass
                    elif isinstance(check_in_raw, date):
                        check_in = check_in_raw

                    if isinstance(check_out_raw, str) and check_out_raw:
                        try:
                            check_out = datetime.strptime(
                                check_out_raw, "%Y-%m-%d"
                            ).date()
                        except Exception:
                            pass
                    elif isinstance(check_out_raw, date):
                        check_out = check_out_raw

                    adults = (
                        options.adults
                        if options and options.adults
                        else (hotel.get("default_adults") or 2)
                    )

                    # 1. Global Cache Check
                    price_data = None
                    if not options or not options.skip_cache:
                        price_data = await self._check_global_cache(
                            str(serp_api_id), check_in
                        )

                    if price_data:
                        await self.log_reasoning(
                            session_id,
                            "Cache",
                            f"HIT: Found shared price of {price_data.get('price')} for {hotel_name}.",
                            "success",
                        )
                    else:
                        # 2. Provider Fetch with Fallback
                        await self.log_reasoning(
                            session_id,
                            "Provider",
                            "Starting multi-provider fetch sequence...",
                            "info",
                        )

                        active_providers = ProviderFactory.get_active_providers()
                        last_error = "No active providers"

                        for provider in active_providers:
                            p_name = provider.get_provider_name()
                            await self.log_reasoning(
                                session_id, "Provider", f"Trying {p_name}...", "info"
                            )

                            try:
                                # Per-hotel logic with timeout
                                current_data = await asyncio.wait_for(
                                    provider.fetch_price(
                                        hotel_name=hotel_name,
                                        location=location,
                                        check_in=check_in,
                                        check_out=check_out,
                                        adults=adults,
                                        currency=getattr(options, "currency", "TRY")
                                        if options
                                        else "TRY",
                                        serp_api_id=serp_api_id,
                                    ),
                                    timeout=120.0,
                                )

                                # Validate results: we want at least a base price or room types
                                if (
                                    current_data
                                    and current_data.get("status") == "success"
                                ):
                                    # If DataForSEO found pricing, we accept it.
                                    # If it's a "deep" result with rooms, even better.
                                    price_val = current_data.get("price")
                                    if price_val is None:
                                        price_val = 0
                                    if price_val > 0 or current_data.get("room_types"):
                                        price_data = current_data
                                        await self.log_reasoning(
                                            session_id,
                                            "Provider",
                                            f"SUCCESS: {p_name} returned price {price_val}.",
                                            "success",
                                        )
                                        break
                                    else:
                                        await self.log_reasoning(
                                            session_id,
                                            "Provider",
                                            f"{p_name} returned empty results. Trying next...",
                                            "warning",
                                        )
                                else:
                                    err_msg = (
                                        current_data.get("error")
                                        if current_data
                                        else "Unknown error"
                                    )
                                    last_error = f"{p_name}: {err_msg}"
                                    await self.log_reasoning(
                                        session_id,
                                        "Provider",
                                        f"FAILED: {p_name} - {err_msg}",
                                        "warning",
                                    )

                            except asyncio.TimeoutError:
                                await self.log_reasoning(
                                    session_id,
                                    "Provider",
                                    f"TIMEOUT: {p_name} exceeded 120s limit.",
                                    "error",
                                )
                                last_error = f"{p_name}: Timeout"
                            except Exception as e:
                                await self.log_reasoning(
                                    session_id,
                                    "Provider",
                                    f"EXCEPTION: {p_name} crash - {str(e)}",
                                    "error",
                                )
                                last_error = f"{p_name}: {str(e)}"

                        if not price_data:
                            price_data = {
                                "status": "error",
                                "error": f"All providers failed. Last issue: {last_error}",
                            }

                    # 3. Normalization logic omitted for brevity in core loop (handled by RoomTypeNormalizer if needed)
                    if price_data and price_data.get("room_types"):
                        for r in price_data["room_types"]:
                            if isinstance(r, dict):
                                try:
                                    norm = RoomTypeNormalizer.normalize(
                                        r.get("name", "")
                                    )
                                    r["canonical_code"] = norm.get("canonical_code")
                                    r["canonical_name"] = norm.get("canonical_name")
                                except Exception:
                                    pass

                    status = (
                        "success"
                        if price_data and price_data.get("status") == "success"
                        else "error"
                    )

                    result = {
                        "hotel_id": hotel_id,
                        "hotel_name": hotel_name,
                        "status": status,
                        "price_data": price_data,
                        "check_in": str(check_in),
                        "adults": adults,
                        "is_deep_scan": price_data.get("is_deep_scan", False),
                    }
                    results.append(result)
                    return result

            except Exception as e:
                err_res = {
                    "hotel_id": hotel_id,
                    "hotel_name": hotel_name,
                    "status": "error",
                    "error": str(e),
                }
                results.append(err_res)
                return err_res

        # Execute all
        await asyncio.gather(*(fetch_hotel(h) for h in hotels if isinstance(h, dict)))

        if session_id:
            await self._flush_logs(session_id)

        return results
