"""
Hotel Location and Identity Resolution Utility
Autonomous resolution of GPS coordinates, Google Place IDs, and stable property tokens
to eliminate Cold Start unmapped hotels across the system.
"""

import hashlib
import os
from typing import Any, Dict, Optional

import httpx
from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def resolve_hotel_metadata(
    name: str, location: Optional[str] = None
) -> Dict[str, Any]:
    """
    Attempts to resolve GPS coordinates, place_id, and standardized address for a hotel.
    Falls back gracefully to deterministic tokens if external APIs fail or return no results.
    """
    clean_name = (name or "").strip()
    clean_loc = (location or "").strip()
    query = f"{clean_name} {clean_loc}".strip()

    result: Dict[str, Any] = {
        "latitude": None,
        "longitude": None,
        "place_id": None,
        "address": None,
        "property_token": None,
        "serp_api_id": None,
    }

    serpapi_key = os.getenv("SERPAPI_API_KEY")
    if serpapi_key and query:
        try:
            url = "https://serpapi.com/search.json"
            params = {
                "q": query,
                "engine": "google_maps",
                "api_key": serpapi_key,
            }
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("local_results") or []
                    if not candidates and data.get("place_results"):
                        candidates = [data.get("place_results")]

                    if candidates and isinstance(candidates, list) and isinstance(candidates[0], dict):
                        first = candidates[0]
                        gps = first.get("gps_coordinates") or {}
                        result["latitude"] = gps.get("latitude")
                        result["longitude"] = gps.get("longitude")
                        result["place_id"] = first.get("place_id")
                        result["address"] = first.get("address")
                        if first.get("place_id"):
                            result["property_token"] = first.get("place_id")
                            result["serp_api_id"] = first.get("place_id")

                        logger.info(
                            f"[Geocoding] Successfully resolved '{query}' -> "
                            f"GPS: ({result['latitude']}, {result['longitude']}), Place ID: {result['place_id']}"
                        )
        except Exception as e:
            logger.warning(f"[Geocoding] Resolution attempt failed for '{query}': {e}")

    # Fallback deterministic token if still missing
    if not result["property_token"]:
        token_hash = hashlib.sha256(
            f"{clean_name.lower()}|{clean_loc.lower()}".encode()
        ).hexdigest()[:20]
        result["property_token"] = f"custom_{token_hash}"
        logger.info(
            f"[Geocoding] Generated deterministic fallback token for '{clean_name}': {result['property_token']}"
        )

    return result
