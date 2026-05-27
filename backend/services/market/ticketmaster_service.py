import os
import httpx
from datetime import date, timedelta
from typing import Any, Dict, List
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)


class TicketmasterService:
    """
    Integrates with Ticketmaster Discovery API (Free tier) to extract localized
    music, sporting, and theatrical events that impact weekend travel compression.
    """

    BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json"

    def __init__(self, db: Client):
        self.db = db
        self.api_key = os.getenv("TICKETMASTER_API_KEY")

    async def fetch_and_sync_events(self, city: str, days: int = 30) -> Dict[str, Any]:
        """
        Fetches events from Ticketmaster and stores/upserts them into InsForge DB.
        """
        if not self.api_key:
            logger.warning("[Ticketmaster] API Key 'TICKETMASTER_API_KEY' not configured. Skipping.")
            return {"status": "skipped", "message": "API key not configured."}

        logger.info(f"[Ticketmaster] Fetching events for {city} over the next {days} days...")
        
        start_date = date.today()
        end_date = start_date + timedelta(days=days)

        # Ticketmaster API parameters
        params = {
            "apikey": self.api_key,
            "city": city,
            "startDateTime": start_date.strftime("%Y-%m-%dT00:00:00Z"),
            "endDateTime": end_date.strftime("%Y-%m-%dT23:59:59Z"),
            "size": 50,
            "sort": "date,asc"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.BASE_URL, params=params)
                
                if response.status_code != 200:
                    logger.error(f"[Ticketmaster] API request failed with status {response.status_code}: {response.text}")
                    return {"status": "error", "message": f"API status {response.status_code}"}

                data = response.json()
                embedded = data.get("_embedded", {})
                results = embedded.get("events", [])
                logger.info(f"[Ticketmaster] Successfully retrieved {len(results)} events.")

                processed_count = 0
                for item in results:
                    try:
                        dates = item.get("dates", {})
                        start = dates.get("start", {})
                        local_date = start.get("localDate", "")

                        if not local_date:
                            continue

                        # Map categories and assign standard compression scores based on segment
                        segment = ""
                        classifications = item.get("classifications", [])
                        if classifications:
                            segment = classifications[0].get("segment", {}).get("name", "").lower()

                        # Determine score based on event scale/segment
                        if segment == "music":
                            compression_score = 5  # Live concerts drive strong hotel demand
                        elif segment == "sports":
                            compression_score = 6  # Live matches drive extreme weekend compression
                        else:
                            compression_score = 3  # Other events

                        # Gather metadata
                        venue_info = item.get("_embedded", {}).get("venues", [{}])[0]
                        venue_name = venue_info.get("name", "Unknown Venue")

                        event_data = {
                            "name": item.get("name", "Unnamed Concert/Show"),
                            "type": "sports" if segment == "sports" else "cultural",
                            "city": city.capitalize(),
                            "start_date": local_date,
                            "end_date": local_date,  # Ticketmaster events are usually single-day
                            "description": f"Live show at {venue_name}. Segment: {segment.capitalize()}",
                            "compression_score": compression_score,
                            "metadata": {
                                "source": "Ticketmaster",
                                "ticketmaster_id": item.get("id"),
                                "venue": venue_name,
                                "url": item.get("url"),
                                "segment": segment
                            }
                        }

                        self.db.table("market_events").upsert(
                            event_data, on_conflict="name, start_date"
                        ).execute()
                        processed_count += 1
                    except Exception as e:
                        logger.warning(f"[Ticketmaster] Error staging event {item.get('name')}: {e}")

                return {"status": "success", "processed": processed_count}

        except Exception as e:
            logger.error(f"[Ticketmaster] Sync failed: {e}")
            return {"status": "error", "message": str(e)}
