import os
import httpx
from datetime import date, timedelta
from typing import Any, Dict, List
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)


class EventbriteService:
    """
    Integrates with Eventbrite API (Free tier) to parse localized business expos,
    trade shows, and public holiday events.
    """

    BASE_URL = "https://www.eventbriteapi.com/v3/events/search/"

    def __init__(self, db: Client):
        self.db = db
        self.api_key = os.getenv("EVENTBRITE_API_KEY")

    async def fetch_and_sync_events(self, city: str, days: int = 30) -> Dict[str, Any]:
        """
        Fetches events from Eventbrite API and stores/upserts them into InsForge DB.
        """
        if not self.api_key:
            logger.warning("[Eventbrite] API Key 'EVENTBRITE_API_KEY' not configured. Skipping.")
            return {"status": "skipped", "message": "API key not configured."}

        logger.info(f"[Eventbrite] Fetching events for {city} over the next {days} days...")
        
        start_date = date.today()
        end_date = start_date + timedelta(days=days)

        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        # Eventbrite parameters (Searching by location address and start date range)
        params = {
            "location.address": city,
            "start_date.range_start": start_date.strftime("%Y-%m-%dT00:00:00Z"),
            "start_date.range_end": end_date.strftime("%Y-%m-%dT23:59:59Z"),
            "expand": "venue"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.BASE_URL, headers=headers, params=params)
                
                if response.status_code != 200:
                    logger.error(f"[Eventbrite] API request failed with status {response.status_code}: {response.text}")
                    return {"status": "error", "message": f"API status {response.status_code}"}

                data = response.json()
                results = data.get("events", [])
                logger.info(f"[Eventbrite] Successfully retrieved {len(results)} events.")

                processed_count = 0
                for item in results:
                    try:
                        name_dict = item.get("name", {})
                        title = name_dict.get("text") or name_dict.get("html") or "Unnamed Eventbrite Event"

                        start_dict = item.get("start", {})
                        start_time_str = start_dict.get("local") or start_dict.get("utc") or ""
                        
                        end_dict = item.get("end", {})
                        end_time_str = end_dict.get("local") or end_dict.get("utc") or ""

                        if not start_time_str:
                            continue

                        # Extract pure YYYY-MM-DD string
                        start_date_str = start_time_str[:10]
                        end_date_str = end_time_str[:10] if end_time_str else start_date_str

                        # Map categories and assign standard compression score
                        is_free = item.get("is_free", True)
                        compression_score = 2 if is_free else 4  # Paid trade shows drive higher compression than free meetups

                        event_data = {
                            "name": title,
                            "type": "fair" if "expo" in title.lower() or "exhibition" in title.lower() else "cultural",
                            "city": city.capitalize(),
                            "start_date": start_date_str,
                            "end_date": end_date_str,
                            "description": item.get("description", {}).get("text", "")[:300],  # Truncate to 300 chars
                            "compression_score": compression_score,
                            "metadata": {
                                "source": "Eventbrite",
                                "eventbrite_id": item.get("id"),
                                "url": item.get("url"),
                                "is_free": is_free
                            }
                        }

                        self.db.table("market_events").upsert(
                            event_data, on_conflict="name, start_date"
                        ).execute()
                        processed_count += 1
                    except Exception as e:
                        logger.warning(f"[Eventbrite] Error staging event {item.get('name', {}).get('text')}: {e}")

                return {"status": "success", "processed": processed_count}

        except Exception as e:
            logger.error(f"[Eventbrite] Sync failed: {e}")
            return {"status": "error", "message": str(e)}
