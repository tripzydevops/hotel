"""
Geo-Grid Discovery Service (DataForSEO + pgvector + Gemini)
Solves the B2B Cold Start problem by autonomously mapping and vectorizing
unindexed regional hotel markets via Google Hotels GPS grid searches.
"""

import asyncio
import math
from typing import Any, Dict, List, Optional
from uuid import UUID

from backend.agents.analyst_agent import AnalystAgent
from backend.services.providers.dataforseo_provider import dataforseo_provider
from backend.utils.db import get_insforge_db
from backend.utils.embeddings import (
    format_hotel_for_embedding,
    get_embeddings_batch,
)
from backend.utils.logger import get_logger

logger = get_logger(__name__)


def generate_grid_coordinates(
    center_lat: float,
    center_lon: float,
    radius_km: float = 10.0,
    points_count: int = 5,
) -> List[Dict[str, Any]]:
    """
    Generates a matrix/star grid of (lat, lon) coordinates around a center point.
    points_count:
      1: Center only
      5: Center, North, South, East, West (Cross pattern)
      9: 3x3 Grid
    """
    coords = [{"lat": center_lat, "lon": center_lon, "label": "center"}]
    if points_count <= 1:
        return coords

    # Approximate coordinate offsets:
    # 1 deg lat ~ 110.574 km
    # 1 deg lon ~ 111.320 * cos(lat) km
    delta_lat = (radius_km * 0.7) / 110.574
    delta_lon = (radius_km * 0.7) / (
        111.320 * math.cos(math.radians(center_lat)) + 1e-6
    )

    if points_count >= 5:
        coords.extend(
            [
                {"lat": center_lat + delta_lat, "lon": center_lon, "label": "north"},
                {"lat": center_lat - delta_lat, "lon": center_lon, "label": "south"},
                {"lat": center_lat, "lon": center_lon + delta_lon, "label": "east"},
                {"lat": center_lat, "lon": center_lon - delta_lon, "label": "west"},
            ]
        )

    if points_count >= 9:
        coords.extend(
            [
                {
                    "lat": center_lat + delta_lat,
                    "lon": center_lon + delta_lon,
                    "label": "northeast",
                },
                {
                    "lat": center_lat + delta_lat,
                    "lon": center_lon - delta_lon,
                    "label": "northwest",
                },
                {
                    "lat": center_lat - delta_lat,
                    "lon": center_lon + delta_lon,
                    "label": "southeast",
                },
                {
                    "lat": center_lat - delta_lat,
                    "lon": center_lon - delta_lon,
                    "label": "southwest",
                },
            ]
        )

    return coords


async def sweep_google_hotels_grid(
    center_lat: Optional[float],
    center_lon: Optional[float],
    location_name: Optional[str] = None,
    radius_km: float = 10.0,
    points_count: int = 5,
) -> List[Dict[str, Any]]:
    """
    Executes live DataForSEO Google Hotels searches across a coordinate grid or location.
    Deduplicates hotels by hotel_identifier and returns clean parsed entities.
    """
    endpoint = (
        f"{dataforseo_provider.api_url}/business_data/google/hotel_searches/live"
    )

    tasks_payloads = []
    if center_lat is not None and center_lon is not None:
        coords = generate_grid_coordinates(
            center_lat, center_lon, radius_km=radius_km, points_count=points_count
        )
        for pt in coords:
            tasks_payloads.append(
                [
                    {
                        "keyword": "hotel",
                        "location_coordinate": f"{pt['lat']:.6f},{pt['lon']:.6f}",
                        "language_code": "en",
                        "depth": 18,
                    }
                ]
            )
    else:
        # Fallback to location_name search with deeper page pull
        clean_loc = dataforseo_provider._normalize_location(location_name or "Turkey")
        tasks_payloads.append(
            [
                {
                    "keyword": "hotel",
                    "location_name": clean_loc,
                    "language_code": "en",
                    "depth": 36,
                }
            ]
        )

    logger.info(
        f"[GeoGridService] Dispatching {len(tasks_payloads)} grid tasks to DataForSEO..."
    )

    async def _fetch_task(payload):
        try:
            res = await dataforseo_provider._post_v3_request(endpoint, payload)
            if res and res.get("tasks"):
                task = res["tasks"][0]
                result = task.get("result") or []
                if result:
                    return result[0].get("items") or []
        except Exception as e:
            logger.error(f"[GeoGridService] Sub-task search failed: {e}")
        return []

    # Execute tasks concurrently
    task_results = await asyncio.gather(*[_fetch_task(p) for p in tasks_payloads])

    # Deduplicate and extract unique properties
    unique_hotels: Dict[str, Dict[str, Any]] = {}
    for items in task_results:
        for item in items:
            hid = item.get("hotel_identifier")
            title = item.get("title")
            if not hid or not title:
                continue

            if hid not in unique_hotels:
                unique_hotels[hid] = item

    logger.info(
        f"[GeoGridService] Discovered {len(unique_hotels)} unique hotels across grid."
    )
    return list(unique_hotels.values())


async def discover_and_seed_regional_grid(
    hotel_id: str,
    radius_km: float = 10.0,
    points_count: int = 5,
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    End-to-End Autonomous Cold Start Solver:
    1. Fetches target hotel coordinates.
    2. Runs DataForSEO Google Hotels Grid Sweep.
    3. Ingests new properties into `hotel_directory`.
    4. Computes Gemini 768-dim embeddings in parallel.
    5. Returns newly ranked local Ghost Competitors.
    """
    admin_db = db or get_insforge_db(admin=True)

    # 1. Fetch target hotel
    h_res = (
        admin_db.table("hotels")
        .select("id, name, location, latitude, longitude, serp_api_id")
        .eq("id", hotel_id)
        .execute()
    )
    if not h_res.data:
        return {"error": f"Target hotel {hotel_id} not found."}

    target = h_res.data[0]
    target_lat = target.get("latitude")
    target_lon = target.get("longitude")
    target_loc = target.get("location")
    target_name_lower = target["name"].strip().lower()

    # Pre-resolve GPS coordinates if missing before grid sweep
    if target_lat is None or target_lon is None:
        try:
            from backend.utils.geocoding import resolve_hotel_metadata

            meta = await resolve_hotel_metadata(target["name"], target_loc)
            if meta.get("latitude") and meta.get("longitude"):
                target_lat = meta["latitude"]
                target_lon = meta["longitude"]
                update_fields: Dict[str, Any] = {
                    "latitude": target_lat,
                    "longitude": target_lon,
                }
                if meta.get("place_id"):
                    update_fields["place_id"] = meta["place_id"]
                    if not target.get("serp_api_id"):
                        update_fields["serp_api_id"] = meta["place_id"]
                    if not target.get("property_token"):
                        update_fields["property_token"] = meta["place_id"]
                if meta.get("address") and not target.get("address"):
                    update_fields["address"] = meta["address"]

                admin_db.table("hotels").update(update_fields).eq("id", hotel_id).execute()
                logger.info(
                    f"[GeoGridService] Pre-resolved coordinates for {target['name']}: {target_lat}, {target_lon}"
                )
        except Exception as pre_e:
            logger.warning(f"[GeoGridService] Pre-resolution attempt failed for {target['name']}: {pre_e}")

    # 2. Sweep Google Hotels
    raw_hotels = await sweep_google_hotels_grid(
        center_lat=target_lat,
        center_lon=target_lon,
        location_name=target_loc,
        radius_km=radius_km,
        points_count=points_count,
    )

    if not raw_hotels:
        return {
            "status": "empty",
            "message": "No hotels found in the selected perimeter.",
            "seeded_count": 0,
            "rivals": [],
        }

    # 3. Identify and heal target hotel coordinates if missing
    if target_lat is None or target_lon is None:
        for rh in raw_hotels:
            rh_title = rh.get("title", "").strip().lower()
            if target_name_lower in rh_title or rh_title in target_name_lower:
                loc_data = rh.get("location") or {}
                if loc_data.get("latitude") and loc_data.get("longitude"):
                    target_lat = loc_data["latitude"]
                    target_lon = loc_data["longitude"]
                    try:
                        admin_db.table("hotels").update(
                            {
                                "latitude": target_lat,
                                "longitude": target_lon,
                                "serp_api_id": target.get("serp_api_id")
                                or rh.get("hotel_identifier"),
                                "property_token": target.get("property_token")
                                or rh.get("hotel_identifier"),
                            }
                        ).eq("id", hotel_id).execute()
                        logger.info(
                            f"[GeoGridService] Healed coordinates for target hotel {target['name']}: {target_lat}, {target_lon}"
                        )
                    except Exception as e:
                        logger.warning(
                            f"[GeoGridService] Could not persist healed coordinates: {e}"
                        )
                    break

    # 4. Filter existing properties in hotel_directory
    serp_ids = [rh["hotel_identifier"] for rh in raw_hotels if rh.get("hotel_identifier")]
    existing_serp_ids = set()

    if serp_ids:
        # Check in chunks of 50
        for i in range(0, len(serp_ids), 50):
            chunk = serp_ids[i : i + 50]
            existing_res = (
                admin_db.table("hotel_directory")
                .select("serp_api_id")
                .in_("serp_api_id", chunk)
                .execute()
            )
            for row in existing_res.data or []:
                if row.get("serp_api_id"):
                    existing_serp_ids.add(row["serp_api_id"])

    # 5. Prepare new hotels for insertion
    new_hotels_to_insert = []
    for rh in raw_hotels:
        hid = rh.get("hotel_identifier")
        if not hid or hid in existing_serp_ids:
            continue

        # Skip target hotel itself (by serp_api_id or name)
        rh_title = (rh.get("title") or "").strip().lower()
        if target.get("serp_api_id") and target.get("serp_api_id") == hid:
            continue
        if target_name_lower == rh_title or target_name_lower in rh_title or rh_title in target_name_lower:
            continue

        loc_data = rh.get("location") or {}
        reviews = rh.get("reviews") or {}
        images = rh.get("overview_images") or []
        prices = rh.get("prices") or {}

        # Resolve location string
        hotel_loc = target_loc or "Turkey"
        if loc_data.get("address"):
            hotel_loc = loc_data["address"]

        new_hotels_to_insert.append(
            {
                "name": rh.get("title"),
                "location": hotel_loc,
                "serp_api_id": hid,
                "property_token": hid,
                "stars": rh.get("stars"),
                "rating": reviews.get("value"),
                "review_count": reviews.get("votes_count") or 0,
                "latitude": loc_data.get("latitude"),
                "longitude": loc_data.get("longitude"),
                "images": images,
                "image_url": images[0] if images else None,
                "pricing_dna": {
                    "estimated_price": prices.get("price"),
                    "currency": prices.get("currency", "USD"),
                },
            }
        )

    # 6. Batch Insert into hotel_directory
    inserted_records = []
    if new_hotels_to_insert:
        logger.info(
            f"[GeoGridService] Inserting {len(new_hotels_to_insert)} new hotels into hotel_directory..."
        )
        try:
            ins_res = (
                admin_db.table("hotel_directory")
                .insert(new_hotels_to_insert)
                .execute()
            )
            inserted_records = ins_res.data or []
        except Exception as e:
            logger.error(f"[GeoGridService] Failed to insert new hotels: {e}")
            # Fallback one-by-one to avoid single duplicate failing entire batch
            for h in new_hotels_to_insert:
                try:
                    one_res = admin_db.table("hotel_directory").insert([h]).execute()
                    if one_res.data:
                        inserted_records.extend(one_res.data)
                except Exception:
                    continue

    # 7. Generate Gemini Embeddings for newly inserted hotels
    if inserted_records:
        logger.info(
            f"[GeoGridService] Generating Gemini 768-dim embeddings for {len(inserted_records)} hotels..."
        )
        texts = [format_hotel_for_embedding(h) for h in inserted_records]
        embeddings = await get_embeddings_batch(texts)

        # Update embeddings in parallel
        async def _update_emb(h_id, emb):
            try:
                admin_db.table("hotel_directory").update({"embedding": emb}).eq(
                    "id", h_id
                ).execute()
            except Exception as e:
                logger.warning(f"[GeoGridService] Failed to store embedding for {h_id}: {e}")

        await asyncio.gather(
            *[_update_emb(h["id"], embeddings[idx]) for idx, h in enumerate(inserted_records)]
        )

    # 8. Query Discover Rivals via AnalystAgent
    analyst = AnalystAgent(admin_db)
    rivals = await analyst.discover_rivals(
        target_identifier=hotel_id, limit=8, radius_km=radius_km
    )

    # 9. Ensure all returned rivals carry their Google IDs (serp_api_id / property_token)
    if rivals:
        rival_ids = [r["id"] for r in rivals if r.get("id")]
        if rival_ids:
            try:
                dir_res = (
                    admin_db.table("hotel_directory")
                    .select("id, serp_api_id, property_token, image_url")
                    .in_("id", rival_ids)
                    .execute()
                )
                dir_map = {d["id"]: d for d in (dir_res.data or [])}
                for r in rivals:
                    d = dir_map.get(r.get("id"))
                    if d:
                        r["serp_api_id"] = d.get("serp_api_id") or d.get("property_token")
                        r["property_token"] = d.get("property_token") or d.get("serp_api_id")
                        if not r.get("image_url") and d.get("image_url"):
                            r["image_url"] = d.get("image_url")
            except Exception as e:
                logger.warning(f"[GeoGridService] Failed to enrich rivals with directory IDs: {e}")

    logger.info(
        f"[GeoGridService] Grid sweep complete. Seeded {len(inserted_records)} new hotels, returned {len(rivals)} rivals with Google IDs."
    )

    return {
        "status": "success",
        "target_hotel": {
            "id": hotel_id,
            "name": target["name"],
            "latitude": target_lat,
            "longitude": target_lon,
        },
        "newly_seeded_count": len(inserted_records),
        "total_discovered": len(raw_hotels),
        "rivals": rivals,
    }
