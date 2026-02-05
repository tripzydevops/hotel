
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
        semaphore = asyncio.Semaphore(10) # Max 10 concurrent requests to SerpApi for enterprise speed
        
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
                
                # Fallback: Auto-generate dates if not provided (for scheduled scans)
                if not check_in or not check_out:
                    from datetime import timedelta
                    today = date.today()
                    check_in = today + timedelta(days=1)  # Tomorrow
                    check_out = today + timedelta(days=2)  # Day after tomorrow
                    print(f"[Scraper] Auto-generated dates for {hotel_name}: {check_in} to {check_out}")
                
                # Fetch price with SerpApi (Original High-Fidelity Source)
                price_data = None
                try:
                    primary_provider = ProviderFactory.get_provider()
                    print(f"[Scraper] Fetching price for {hotel_name} via {primary_provider.get_provider_name()}...")
                    
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
                    print(f"[Scraper] Primary Provider Error for {hotel_name}: {e}")
                
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

                # [NEW] Persist Rich Data to Hotel Record
                if price_data:
                    try:
                        update_payload = {}
                        if price_data.get("images"):
                            update_payload["images"] = price_data["images"]
                            if not hotel.get("image_url") and price_data["images"]:
                                update_payload["image_url"] = price_data["images"][0].get("thumbnail") or price_data["images"][0].get("original")
                        elif price_data.get("photos"):
                            imgs = [{"original": url, "thumbnail": url} for url in price_data["photos"][:5]]
                            update_payload["images"] = imgs
                            if not hotel.get("image_url") and imgs:
                                update_payload["image_url"] = imgs[0]["thumbnail"]
                        
                        if price_data.get("amenities"):
                            update_payload["amenities"] = price_data["amenities"]
                            
                        if price_data.get("rating"):
                            update_payload["rating"] = price_data["rating"]

                        # [NEW] Sentiment & Reviews Persistence
                        if "reviews_breakdown" in price_data:
                            update_payload["sentiment_breakdown"] = price_data["reviews_breakdown"]
                            
                        # Handle review snippets (reviews_list from provider)
                        if "reviews_list" in price_data and price_data["reviews_list"]:
                            update_payload["reviews"] = price_data["reviews_list"][:5]
                        elif "reviews" in price_data and isinstance(price_data["reviews"], list):
                            update_payload["reviews"] = price_data["reviews"][:5]

                        if update_payload:
                            self.db.table("hotels").update(update_payload).eq("id", str(hotel_id)).execute()
                            # print(f"[Scraper] Updated metadata for {hotel_name}")

                    except Exception as e:
                        print(f"[Scraper] Metadata Update Error: {e}")

                results.append(result)
                return result

        # Run all hotels in parallel with semaphore control
        await asyncio.gather(*(fetch_hotel(h) for h in hotels))
        return results
