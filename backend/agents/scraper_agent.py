
import asyncio
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from supabase import Client
from backend.models.schemas import ScanOptions
from backend.services.provider_factory import ProviderFactory
from backend.utils.helpers import log_query

class ScraperAgent:
    """
    Agent responsible for high-speed data acquisition from SerpApi.
    2026 Strategy: Decoupled from monolith for independent scaling.
    """
    def __init__(self, db: Client):
        self.db = db

    async def run_scan(
        self,
        user_id: UUID,
        hotels: List[Dict[str, Any]],
        options: Optional[ScanOptions],
        session_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Performs the actual scraping for a list of hotels."""
        results = []
        semaphore = asyncio.Semaphore(3) # Max 3 concurrent requests to SerpApi
        
        # Update session status
        if session_id:
            try:
                self.db.table("scan_sessions").update({"status": "running"}).eq("id", str(session_id)).execute()
            except Exception as e:
                print(f"[ScraperAgent] Error updating session: {e}")

        async def fetch_hotel(hotel):
            async with semaphore:
                hotel_id = hotel["id"]
                hotel_name = hotel["name"]
                location = hotel.get("location")
                serp_api_id = hotel.get("serp_api_id")
                
                # Determine search parameters
                check_in_raw = options.check_in if options and options.check_in else hotel.get("fixed_check_in")
                check_out_raw = options.check_out if options and options.check_out else hotel.get("fixed_check_out")
                
                # Normalize Dates (Prevent 'str' object has no attribute 'strftime' error)
                check_in = check_in_raw
                if isinstance(check_in_raw, str):
                    try:
                        check_in = datetime.strptime(check_in_raw, "%Y-%m-%d").date()
                    except ValueError:
                        check_in = None # Handle invalid format

                check_out = check_out_raw
                if isinstance(check_out_raw, str):
                    try:
                        check_out = datetime.strptime(check_out_raw, "%Y-%m-%d").date()
                    except ValueError:
                        check_out = None

                adults = options.adults if options and options.adults else (hotel.get("default_adults") or 2)
                
                # Fetch price with FAILOVER
                price_data = None
                if check_in and check_out:
                    providers = ProviderFactory.get_active_providers()
                    
                    for provider in providers:
                        try:
                            # print(f"[Scraper] Trying Provider: {provider.get_provider_name()}")
                            price_data = await provider.fetch_price(
                                hotel_name=hotel_name,
                                location=location,
                                check_in=check_in,
                                check_out=check_out,
                                adults=adults,
                                currency=options.currency if options and options.currency else "USD"
                            )
                            if price_data:
                                break # Success
                        except Exception as e:
                            print(f"[Scraper] Provider {provider.get_provider_name()} Error: {e}")
                            continue
                else:
                    print(f"[Scraper] Invalid Dates for {hotel_name}: {check_in_raw} - {check_out_raw}")
                
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

        # Run all hotels in parallel with semaphore control
        await asyncio.gather(*(fetch_hotel(h) for h in hotels))
        return results
