
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
                check_in = options.check_in if options and options.check_in else hotel.get("fixed_check_in")
                check_out = options.check_out if options and options.check_out else hotel.get("fixed_check_out")
                adults = options.adults if options and options.adults else (hotel.get("default_adults") or 2)
                
                # Fetch price
                # Use Provider Factory to get the best available provider
                try:
                    provider = ProviderFactory.get_provider(prefer="auto")
                    # print(f"[Scraper] Using Provider: {provider.get_provider_name()}")
                    
                    price_data = await provider.fetch_price(
                        hotel_name=hotel_name,
                        location=location,
                        check_in=check_in,
                        check_out=check_out,
                        adults=adults,
                        currency=options.currency if options and options.currency else "USD"
                    )
                except Exception as e:
                    print(f"[Scraper] Provider Error: {e}")
                    price_data = None
                
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
