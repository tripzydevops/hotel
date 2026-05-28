import os
import httpx
from datetime import date, timedelta
from typing import Any, Dict, List
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)


class PredictHQService:
    """
    Integrates with PredictHQ API (Free/Trial tier) to fetch demand-impacting events
    (concerts, sports, festivals, expos) for a specific city and date range.
    """

    BASE_URL = "https://api.predicthq.com/v1/events/"

    def __init__(self, db: Client):
        self.db = db
        # Retrieve key from environment variable
        self.api_key = os.getenv("PREDICTHQ_API_KEY")

    async def fetch_and_sync_events(self, city: str, days: int = 30) -> Dict[str, Any]:
        """
        Fetches events from PredictHQ and stores/upserts them into InsForge DB.
        """
        if not self.api_key:
            logger.warning("[PredictHQ] API Key 'PREDICTHQ_API_KEY' not configured. Skipping.")
            return {"status": "skipped", "message": "API key not configured."}

        logger.info(f"[PredictHQ] Fetching events for {city} over the next {days} days...")
        
        start_date = date.today()
        end_date = start_date + timedelta(days=days)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }

        # PredictHQ uses ISO dates and locations. We search by city name.
        params = {
            "active.gte": start_date.isoformat(),
            "active.lte": end_date.isoformat(),
            "q": city,
            "limit": 50,
            "sort": "rank"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.BASE_URL, headers=headers, params=params)
                
                if response.status_code != 200:
                    logger.error(f"[PredictHQ] API request failed with status {response.status_code}: {response.text}")
                    return {"status": "error", "message": f"API status {response.status_code}"}

                data = response.json()
                results = data.get("results", [])
                logger.info(f"[PredictHQ] Successfully retrieved {len(results)} events.")

                events_list = []
                for item in results:
                    try:
                        # Map PredictHQ event properties to market_events schema
                        phq_rank = item.get("rank", 0)
                        compression_score = max(min(int(phq_rank / 10), 10), 1)

                        event_data = {
                            "name": item.get("title", "Unnamed PredictHQ Event"),
                            "type": "fair" if item.get("category") == "expos" else "cultural",
                            "city": city.capitalize(),
                            "start_date": item.get("start", "")[:10],  # Get date part YYYY-MM-DD
                            "end_date": item.get("end", "")[:10],
                            "description": item.get("description", ""),
                            "compression_score": compression_score,
                            "metadata": {
                                "source": "PredictHQ",
                                "predicthq_id": item.get("id"),
                                "category": item.get("category"),
                                "labels": item.get("labels", [])
                            }
                        }

                        # Basic validity checks
                        if not event_data["start_date"] or not event_data["end_date"]:
                            continue

                        events_list.append(event_data)
                    except Exception as e:
                        logger.warning(f"[PredictHQ] Error processing event {item.get('title')}: {e}")

                if events_list:
                    # Perform dynamic bulk RPC upsert (bypasses PostgREST REST 404 cache limits)
                    rpc_res = self.db.rpc("stage_market_events", {"events": events_list}).execute()
                    processed_count = rpc_res.data.get("processed", len(events_list))
                else:
                    processed_count = 0

                return {"status": "success", "processed": processed_count}

        except Exception as e:
            logger.error(f"[PredictHQ] Sync failed: {e}")
            return {"status": "error", "message": str(e)}
