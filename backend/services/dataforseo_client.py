"""
DataForSEO Client for Hotel Metadata Enrichment
Fetches detailed hotel information (amenities, contact details, etc.) using DataForSEO API.
"""

import base64
import json
import os
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

from backend.utils.logger import get_logger

logger = get_logger(__name__)

load_dotenv()
load_dotenv(".env.local", override=True)


class DataForSEOClient:
    """
    Client for interacting with DataForSEO API to get rich hotel metadata.
    """

    def __init__(self):
        self.login = os.getenv("DATAFORSEO_LOGIN")
        self.password = os.getenv("DATAFORSEO_PASSWORD")
        self.base_url = "https://api.dataforseo.com/v3"

        if not self.login or not self.password:
            logger.warning("DataForSEO credentials not found in environment.")

    def _get_auth_header(self) -> Dict[str, str]:
        """Generate Basic Auth header."""
        auth_str = f"{self.login}:{self.password}"
        encoded_auth = base64.b64encode(auth_str.encode()).decode()
        return {
            "Authorization": f"Basic {encoded_auth}",
            "Content-Type": "application/json",
        }

    async def get_hotel_details(
        self, hotel_name: str, location: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch hotel details using Google Maps Business Data API.
        """
        if not self.login or not self.password:
            return None

        endpoint = f"{self.base_url}/business_data/google/hotel_info/task_post"

        # DataForSEO requires a specific payload format
        payload = [
            {
                "keyword": f"{hotel_name} {location}",
                "language_code": "en",
                "location_name": location,
            }
        ]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    headers=self._get_auth_header(),
                    content=json.dumps(payload),
                )

                if response.status_code == 200:
                    data = response.json()
                    if data.get("status_code") == 20100 and data.get("tasks"):
                        task = data["tasks"][0]
                        return {
                            "status": "pending",
                            "task_id": task.get("id"),
                            "message": "Metadata enrichment task submitted.",
                        }
                else:
                    logger.error(
                        f"DataForSEO error: {response.status_code} - {response.text}"
                    )
        except Exception as e:
            logger.error(f"DataForSEO request failed: {e}")

        return None

    def _map_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Map DataForSEO result fields to internal format."""
        return {
            "name": result.get("title"),
            "address": result.get("address"),
            "phone": result.get("phone"),
            "website": result.get("url"),
            "rating": result.get("rating", {}).get("value"),
            "review_count": result.get("rating", {}).get("votes_count"),
            "amenities": result.get("amenities"),
            "latitude": result.get("latitude"),
            "longitude": result.get("longitude"),
            "place_id": result.get("place_id"),
            "cid": result.get("cid"),
            "metadata_source": "dataforseo",
        }


# Singleton instance
dataforseo_client = DataForSEOClient()
