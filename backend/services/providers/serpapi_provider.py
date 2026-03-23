import os
import httpx
import re
import threading
import asyncio
from typing import Optional, List, Dict, Any
from datetime import date, timedelta, datetime
from ..data_provider_interface import HotelDataProvider
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# --- Provider Implementation ---


class SerpApiProvider(HotelDataProvider):
    """
    SerpApi Provider implementation for Google Hotels.
    """

    BASE_URL = "https://serpapi.com/search"

    def __init__(self):
        # We now use the unified serpapi_client singleton from ..serpapi_client
        from ..serpapi_client import serpapi_client

        self._serp_client = serpapi_client

    def get_provider_name(self) -> str:
        return "SerpApi"

    def get_active_key_index(self) -> int:
        return self._serp_client._key_manager.current_key_index


    async def fetch_price(
        self,
        hotel_name: str,
        location: str,
        check_in: date,
        check_out: date,
        adults: int = 2,
        currency: str = "USD",
        serp_api_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Delegates fetching and rotation to the unified SerpApiClient.
        """
        try:
            result = await self._serp_client.fetch_hotel_price(
                hotel_name=hotel_name,
                location=location,
                check_in=check_in,
                check_out=check_out,
                adults=adults,
                currency=currency,
                serp_api_id=serp_api_id
            )
            
            # Inject current key suffix for logging transparency
            if result and isinstance(result, dict):
                result["api_key_suffix"] = self._serp_client.api_key[-5:]
            
            # Harmonize status for provider interface expectations
            if result and "error" in result:
                if result["error"] == "quota_exhausted":
                    return {"status": "error", "error": "quota_exhausted", "message": "All API keys exhausted"}
                return {"status": "error", "error": result["error"]}
            
            return result
        except Exception as e:
            logger.error(f"SerpApiProvider delegation error: {e}")
            return {"status": "error", "error": str(e)}
