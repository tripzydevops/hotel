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

    async def _check_global_cache(self, serp_api_id: str, check_in: date) -> Optional[Dict[str, Any]]:
        """
        KAİZEN: Cross-User Shared Cache (GlobalPulse)
        Searches price_logs for ANY hotel that shares the same serp_api_id.
        Verification logic: Data must be within 12 hours.
        """
        if not serp_api_id or serp_api_id == "None":
            return None

        try:
            # 1. Find all hotel IDs sharing this SerpApi ID
            hotels_res = self.db.table("hotels").select("id").eq("serp_api_id", serp_api_id).execute()
            sharing_hotel_ids = [h["id"] for h in (hotels_res.data or [])]
            
            if not sharing_hotel_ids:
                return None

            # 2. Check for recent logs for any of these hotels
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
            
            logs_res = (
                self.db.table("price_logs")
                .select("*")
                .in_("hotel_id", sharing_hotel_ids)
                .eq("check_in_date", check_in.isoformat())
                .gte("recorded_at", cutoff)
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
            )
            
            if logs_res.data:
                log = logs_res.data[0]
                print(f"[GlobalPulse] HIT for {serp_api_id} on {check_in}")
                return {
                    "price": float(log["price"]),
                    "currency": log.get("currency", "USD"),
                    "status": "success",
                    "vendor": log.get("vendor"),
                    "offers": log.get("offers", []),
                    "room_types": log.get("room_types", []),
                    "metadata": log.get("metadata", {}),
                    "recorded_at": log["recorded_at"],
                    "source": "global_pulse"
                }
        except Exception as e:
            print(f"[GlobalPulse] Cache lookup error: {e}")
            
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
        semaphore = asyncio.Semaphore(10)

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
                async with semaphore:
                    await self.log_reasoning(
                        session_id, "Resource", f"Processing {hotel_name} (SerpApi ID: {serp_api_id})", "info"
                    )

                    # Determine dates
                    check_in_raw = options.check_in if options and options.check_in else hotel.get("fixed_check_in")
                    check_out_raw = options.check_out if options and options.check_out else hotel.get("fixed_check_out")
                    
                    check_in: date = date.today() + timedelta(days=1)
                    check_out: date = date.today() + timedelta(days=2)

                    if isinstance(check_in_raw, str) and check_in_raw:
                        try: check_in = datetime.strptime(check_in_raw, "%Y-%m-%d").date()
                        except: pass
                    elif isinstance(check_in_raw, date): check_in = check_in_raw

                    if isinstance(check_out_raw, str) and check_out_raw:
                        try: check_out = datetime.strptime(check_out_raw, "%Y-%m-%d").date()
                        except: pass
                    elif isinstance(check_out_raw, date): check_out = check_out_raw

                    adults = options.adults if options and options.adults else (hotel.get("default_adults") or 2)

                    # 1. GlobalPulse Check
                    price_data = await self._check_global_cache(str(serp_api_id), check_in)

                    if price_data:
                        await self.log_reasoning(
                            session_id, "Cache", f"HIT: Found shared price of {price_data.get('price')} for {hotel_name}.", "success"
                        )
                    else:
                        await self.log_reasoning(session_id, "Cache", "MISS: Fetching fresh from SerpApi.", "info")
                        # 2. Fetch from Provider
                        # KAİZEN: SerpApi Priority
                        # We use ProviderFactory but explicitly request SerpApi unless user forced another.
                        pref = getattr(options, "provider", "serpapi") if options else "serpapi"
                        provider = ProviderFactory.get_provider(prefer=pref)
                        
                        try:
                            # Per-hotel logic
                            price_data = await asyncio.wait_for(
                                provider.fetch_price(
                                    hotel_name=hotel_name,
                                    location=location,
                                    check_in=check_in,
                                    check_out=check_out,
                                    adults=adults,
                                    currency=getattr(options, "currency", "TRY") if options else "TRY",
                                    serp_api_id=serp_api_id
                                ),
                                timeout=120.0
                            )
                        except Exception as e:
                            price_data = {"status": "error", "error": str(e)}

                    # 3. Normalization logic omitted for brevity in core loop (handled by RoomTypeNormalizer if needed)
                    if price_data and price_data.get("room_types"):
                        for r in price_data["room_types"]:
                            if isinstance(r, dict):
                                try:
                                    norm = RoomTypeNormalizer.normalize(r.get("name", ""))
                                    r["canonical_code"] = norm.get("canonical_code")
                                    r["canonical_name"] = norm.get("canonical_name")
                                except: pass

                    status = "success" if price_data and price_data.get("status") == "success" else "error"
                    
                    result = {
                        "hotel_id": hotel_id,
                        "hotel_name": hotel_name,
                        "status": status,
                        "price_data": price_data,
                        "check_in": str(check_in),
                        "adults": adults
                    }
                    results.append(result)
                    return result

            except Exception as e:
                err_res = {"hotel_id": hotel_id, "hotel_name": hotel_name, "status": "error", "error": str(e)}
                results.append(err_res)
                return err_res

        # Execute all
        await asyncio.gather(*(fetch_hotel(h) for h in hotels if isinstance(h, dict)))

        if session_id:
            await self._flush_logs(session_id)

        return results
