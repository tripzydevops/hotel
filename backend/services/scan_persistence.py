import asyncio
import copy
import math
import re
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, cast
from collections import Counter
from uuid import UUID

from backend.models.schemas import ScanOptions
from backend.services.predictive_service import predictive_service
from backend.services.price_comparator import price_comparator
from backend.utils.embeddings import format_room_type_for_embedding, get_embedding
from backend.utils.helpers import convert_currency, normalize_room_name
from backend.utils.logger import get_logger
from backend.utils.sentiment_utils import generate_mentions, merge_sentiment_breakdowns
from backend.utils.db import InsForgeClient

logger = get_logger(__name__)


class ScanPersistenceService:
    """
    Unified Tier-1 Service for persisting scan results.

    This service acts as the 'Data Quality Firewall' for the Antigravity OS.
    It handles:
    1. PRICE VALIDATION: Rejects unrealistic or highly-variant prices.
    2. SMART CONTINUITY: Uses historical fallbacks if a real-time scan fails.
    3. RESILIENT INSERTION: Handles batch failures with per-item fallbacks (Bypassing RLS via Admin Client).
    4. CATALOGING: Normalizes and snapshots room types and rich reviews (Sentiment/NLP ready).
    """

    def __init__(self, insforge: InsForgeClient, admin_insforge: Optional[InsForgeClient] = None):
        self.insforge = insforge
        self.admin_insforge = admin_insforge or insforge  # Fallback to shared if admin not provided

    def _extract_review_count(self, data: Dict[str, Any]) -> Optional[int]:
        """Safely extract review count from provider response."""
        rc = data.get("reviews_count")
        if rc is not None and not isinstance(rc, list):
            try:
                return int(rc)
            except (ValueError, TypeError):
                pass
        
        r = data.get("reviews")
        if isinstance(r, (int, float)):
            return int(r)
        elif isinstance(r, list):
            return len(r)
        elif isinstance(r, str) and r.isdigit():
            return int(r)
            
        return None

    async def _resilient_insert(self, table_name: str, items: List[Dict[str, Any]]):
        """Helper for batch insertion with per-item fallback on failure."""
        if not items:
            return
        try:
            # Use admin_db for persistence in background to avoid RLS/Session issues
            self.admin_insforge.table(table_name).insert(items).execute()
        except Exception as e:
            logger.warning(
                f"Batch insert for {table_name} failed: {e}. Falling back to individual inserts."
            )
            # Per-item fallback
            for item in items:
                try:
                    self.admin_insforge.table(table_name).insert(item).execute()
                except Exception as item_err:
                    # Log and ignore individual failures to keep the pipeline moving
                    logger.error(
                        f"Failed to persist {table_name} item for {item.get('hotel_id')}: {item_err}"
                    )

    async def vault_log(
        self, db: Any, session_id: str, endpoint: str, data: Any
    ) -> None:
        """Log raw payload to the Everything Vault (scan_sessions.raw_payload)."""
        if not db or not session_id:
            return

        try:
            vault_item = {
                "endpoint": endpoint,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": data,
            }
            # Use existing RPC for atomic appending
            db.rpc("append_scan_raw_payload", {
                "session_id": session_id,
                "payload_item": vault_item
            }).execute()
        except Exception as e:
            logger.error(f"Everything Vault Error: {e}")

    async def persist_scan_results(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        settings: Optional[Dict[str, Any]] = None,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None,
        log_reasoning_fn=None,  # Optional callback for logging reasoning
        action_type: str = "monitor",
    ) -> Dict[str, Any]:
        """
        Executes the persistence pipeline for a batch of scraper results.

        This is the primary entry point for ALL scan data (Manual and System).
        It orchestrates the flow from raw scraper results -> Validated DB Entries.

        Pipeline Flow:
        1. Fetch History Mapping (for variance checks).
        2. Per-Hotel Logic (Validation -> Normalization -> Fallback).
        3. Batch Resilient Insertion (Optimized for PostgreSQL performance).
        4. Secondary Tasks (Embeddings, Review Extraction, Catalog updates).
        """
        analysis_summary = {
            "prices_updated": 0,
            "alerts": [],
            "target_price": None,
        }

        hotel_ids = [
            str(res.get("hotel_id")) for res in scraper_results if res.get("hotel_id")
        ]
        if not hotel_ids:
            return analysis_summary

        # 1. Batch History & Metadata Lookup
        history_map = await self._fetch_history_map(hotel_ids)
        hotel_metadata = await self._fetch_hotel_metadata_map(hotel_ids)

        if log_reasoning_fn:
            await log_reasoning_fn(
                session_id,
                "Memory",
                f"Batch history & metadata lookup complete for {len(hotel_ids)} properties.",
                "info",
            )

        # Batch collectors
        price_logs_to_insert = []
        sentiment_history_to_insert = []
        alerts_to_insert = []
        query_logs_to_insert = []
        reviews_to_insert = []
        embedding_queue = []
        volatilities = []

        for res in scraper_results:
            hotel_id = res.get("hotel_id")
            if not hotel_id:
                continue

            hotel_history = history_map.get(hotel_id, [])

            # Process individual hotel result
            processed = await self._process_hotel_entry(
                user_id=user_id,
                result=res,
                history=hotel_history,
                metadata=hotel_metadata.get(hotel_id, {}),
                threshold=threshold,
                options=options,
                session_id=session_id,
                log_reasoning_fn=log_reasoning_fn,
                action_type=action_type,
            )

            if processed.get("price_log"):
                price_logs_to_insert.append(processed["price_log"])
                analysis_summary["prices_updated"] += 1

            if processed.get("sentiment_history"):
                sentiment_history_to_insert.append(processed["sentiment_history"])

            if processed.get("alert"):
                alerts_to_insert.append(processed["alert"])
                analysis_summary["alerts"].append(processed["alert"])

            if processed.get("embedding_task"):
                embedding_queue.append(processed["embedding_task"])

            if processed.get("volatility") is not None:
                volatilities.append(processed["volatility"])

            if processed.get("rich_reviews"):
                reviews_to_insert.extend(processed["rich_reviews"])

            # 1.5 Prepare Query Log entry for audit
            query_logs_to_insert.append(processed["query_log"])

        # 2. Final Batch Insertions with Resilience
        # We now attempt batch inserts but provide a per-hotel fallback if batch fails
        # (e.g. due to unique constraint violations on idx_price_logs_dedup)

        # Execute insertions
        await self._resilient_insert("price_logs", price_logs_to_insert)
        await self._resilient_insert("sentiment_history", sentiment_history_to_insert)
        await self._resilient_insert("alerts", alerts_to_insert)
        await self._resilient_insert("query_logs", query_logs_to_insert)

        # EXPLANATION: Granular Review Persistence (Kaizen 2026)
        # While the 'hotels' table stores a JSON snapshot of reviews for fast UI display,
        # we also persist individual review objects to the 'hotel_reviews' table.
        # This enables long-term historical sentiment analysis and NLP tasks.
        await self._resilient_insert("hotel_reviews", reviews_to_insert)

        # 3. Parallel Embedding Generation
        if embedding_queue:
            await self._process_embeddings(
                embedding_queue, session_id, log_reasoning_fn
            )

        analysis_summary["volatility_avg"] = (
            sum(volatilities) / len(volatilities) if volatilities else 0.0
        )

        # KAİZEN: Report the adjusted threshold used for this session
        if volatilities:
            from backend.services.predictive_service import predictive_service

            analysis_summary["smart_threshold"] = (
                predictive_service.get_smart_threshold(
                    threshold, analysis_summary["volatility_avg"]
                )
            )
        else:
            analysis_summary["smart_threshold"] = threshold

        return analysis_summary

    def _normalize_room_types(self, rooms: Any) -> List[Dict[str, Any]]:
        """
        KAİZEN 2026: Normalizes room type data into a consistent object structure.
        Prevents frontend errors where strings are expected to be objects (e.g. room.name).
        """
        if not rooms or not isinstance(rooms, list):
            return []
            
        normalized = []
        for r in rooms:
            if isinstance(r, str):
                normalized.append({
                    "name": r,
                    "price": None,
                    "currency": None
                })
            elif isinstance(r, dict):
                # Ensure we have a 'name' field
                name = r.get("name") or r.get("room_type") or r.get("type")
                if not name:
                    continue
                    
                entry = {
                    "name": name,
                    "price": r.get("price"),
                    "currency": r.get("currency"),
                    "amenities": r.get("amenities") or r.get("features") or [],
                    "sqm": r.get("sqm"),
                    "capacity": r.get("capacity"),
                    "image_url": r.get("image_url")
                }
                # Preserve any other useful metadata
                for k, v in r.items():
                    if k not in entry:
                        entry[k] = v
                normalized.append(entry)
                
        return normalized

    async def update_room_type_catalog(
        self,
        hotel_id: str,
        rooms: List[Dict[str, Any]],
        hotel_context: Optional[Dict[str, Any]] = None,
    ):
        """
        Normalizes and snapshots room types in a dedicated catalog.
        Provides a stable profile for each room variation with semantic embeddings.
        """

        # 1. Fetch hotel context if not provided
        if not hotel_context:
            try:
                res = (
                    self.admin_insforge.table("hotels")
                    .select("id, name, stars, location")
                    .eq("id", hotel_id)
                    .maybe_single()
                    .execute()
                )
                hotel_context = cast(Dict[str, Any], res.data or {}) if res else {}
            except Exception:
                hotel_context = {}

        valid_upserts = []

        for room in rooms:
            original_name = room.get("name")
            if not original_name:
                continue

            normalized = normalize_room_name(original_name)
            room_id = f"room_{hotel_id}_{normalized.replace(' ', '_').lower()}"

            # Prepare for embedding
            try:
                # Use standard formatter
                text = format_room_type_for_embedding(room, hotel_context=hotel_context)
                embedding = await get_embedding(text)
            except Exception as e:
                logger.error(f"Embedding failed for room {original_name}: {e}")
                embedding = None

            catalog_entry = {
                "id": room_id,
                "hotel_id": hotel_id,
                "original_name": original_name,
                "normalized_name": normalized,
                "avg_price": room.get("price"),
                "currency": room.get("currency", "TRY"),
                "amenities": room.get("features") or room.get("amenities", []),
                "sqm": room.get("sqm"),
                "capacity": room.get("capacity"),
                "image_url": room.get("image_url"),
                "source": room.get("source"),
                "url": room.get("url"),
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
            }
            if embedding:
                catalog_entry["embedding"] = embedding

            valid_upserts.append(catalog_entry)

        if valid_upserts:
            try:
                # Filter out None values
                valid_upserts = [
                    {k: v for k, v in r.items() if v is not None} for r in valid_upserts
                ]
                self.admin_insforge.table("room_type_catalog").upsert(
                    valid_upserts, on_conflict="id"
                ).execute()
            except Exception as e:
                logger.error(f"Batch catalog upsert failed for {hotel_id}: {e}")

    async def batch_update_room_type_catalog(
        self, scraper_results: List[Dict[str, Any]], hotels: List[Dict[str, Any]]
    ):
        """
        Batch process room types from multiple hotels with vectorized embedding generation.
        KAİZEN: Single-shot embedding call for the entire scan batch.
        """
        from backend.utils.embeddings import get_embeddings_batch

        hotel_map = {str(h.get("id")): h for h in hotels}

        rooms_to_embed = []  # List of tuples: (hotel_id, room_dict, formatted_text)

        for result in scraper_results:
            hotel_id = result.get("hotel_id")
            if not hotel_id:
                continue

            rooms = result.get("room_catalog") or result.get("room_types") or []
            if not rooms and "price_data" in result:
                p_data = result.get("price_data", {})
                rooms = p_data.get("room_catalog") or p_data.get("room_types") or []

            if isinstance(rooms, list) and rooms:
                hotel_ctx = hotel_map.get(str(hotel_id))
                for r in rooms:
                    room_dict = {"name": r} if isinstance(r, str) else r
                    if not room_dict.get("name"):
                        continue

                    text = format_room_type_for_embedding(
                        room_dict, hotel_context=(hotel_ctx or {})
                    )
                    rooms_to_embed.append((hotel_id, room_dict, text))

        if not rooms_to_embed:
            return

        # 1. Vectorized Embedding Retrieval
        texts = [t[2] for t in rooms_to_embed]
        embeddings = await get_embeddings_batch(texts)

        # 2. Prepare UPSERT payloads
        valid_upserts = []
        for i, (hotel_id, room, text) in enumerate(rooms_to_embed):
            normalized = normalize_room_name(room["name"])
            room_id = f"room_{hotel_id}_{normalized.replace(' ', '_').lower()}"

            catalog_entry = {
                "id": room_id,
                "hotel_id": hotel_id,
                "original_name": room["name"],
                "normalized_name": normalized,
                "avg_price": room.get("price"),
                "currency": room.get("currency", "TRY"),
                "amenities": room.get("features") or room.get("amenities", []),
                "sqm": room.get("sqm"),
                "capacity": room.get("capacity"),
                "image_url": room.get("image_url"),
                "source": room.get("source"),
                "url": room.get("url"),
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
                "embedding": embeddings[i],
            }
            # Remove None values
            payload = {k: v for k, v in catalog_entry.items() if v is not None}
            valid_upserts.append(payload)

        # 3. Resilient Bulk Persistence with Pagination
        if valid_upserts:
            batch_size = 200 # Safe size for Postgres + Embedding payload
            for i in range(0, len(valid_upserts), batch_size):
                batch = valid_upserts[i : i + batch_size]
                try:
                    self.admin_insforge.table("room_type_catalog").upsert(
                        batch, on_conflict="id"
                    ).execute()
                except Exception as e:
                    logger.error(f"Batch catalog upsert failed for chunk {i//batch_size}: {e}")
                    # Per-item fallback for the failed batch
                    for item in batch:
                        try:
                            self.admin_insforge.table("room_type_catalog").upsert(
                                item, on_conflict="id"
                            ).execute()
                        except Exception as item_err:
                            logger.error(f"Individual catalog upsert failed for {item.get('id')}: {item_err}")
            
            logger.info(f"[Catalog] Vectorized sync complete for {len(valid_upserts)} rooms across {math.ceil(len(valid_upserts)/batch_size)} chunks.")

    async def sync_from_external_provider(
        self,
        db: InsForgeClient,
        hotel_id: str,
        result: Dict[str, Any],
        scan_task_id: Optional[str] = None,
        batch_id: Optional[str] = None,
        source: str = "System",
    ) -> Dict[str, Any]:
        """
        Tier-2 Sync logic for external data providers (e.g. DataForSEO).
        Mirrors the monitor logic but targeted at extraction results.
        """
        if not result or result.get("status") != "success":
            return {"status": "skipped", "reason": "invalid_result"}

        price = result.get("price", 0.0)
        currency = result.get("currency")

        # Room Types Priority: Prefer rich catalog objects over simple string names
        # KAİZEN 2026: Always normalize to objects to prevent frontend "Target Chamber" errors
        current_room_types = self._normalize_room_types(
            result.get("room_catalog") or result.get("room_types") or []
        )

        # If room_types is empty, try to derive from offers/prices (Market Depth)
        if not current_room_types and (result.get("all_prices") or result.get("offers")):
            source_offers = result.get("all_prices") or result.get("offers") or []
            current_room_types = [
                {"name": of.get("name") or of.get("room_type"), "price": of.get("price")} 
                for of in source_offers if of.get("name") or of.get("room_type")
            ]

        # [KAIZEN 2026] Anomaly Detection Safeguard (30% Variance)
        # Fetch 5-day history for baseline calculation
        is_anomaly = False
        try:
            history_map = await self._fetch_history_map([hotel_id])
            hist = history_map.get(hotel_id, [])
            recent_valid = [
                float(h["price"])
                for h in hist
                if h.get("price") is not None and float(h["price"]) > 0 and not h.get("is_anomaly", False)
            ]
            
            if recent_valid and price > 0:
                avg_baseline = sum(recent_valid) / len(recent_valid)
                # REJECT if price deviates by more than 30% from verified baseline
                lower_bound = avg_baseline * 0.7
                upper_bound = avg_baseline * 1.3
                if price < lower_bound or price > upper_bound:
                    is_anomaly = True
        except Exception as e:
            logger.error(f"Anomaly detection failed in individual sync for {hotel_id}: {e}")

        log_entry = {
            "hotel_id": hotel_id,
            "price": price,
            "currency": currency,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "check_in_date": result.get("check_in_date") or result.get("check_in") or str(date.today()),
            "check_out_date": result.get("check_out_date") or result.get("check_out"),
            "vendor": result.get("vendor", source),
            "room_types": current_room_types,
            "parity_offers": result.get("parity_offers") or result.get("offers") or [],
            "offers": result.get("offers") or [],
            "market_offers": result.get("all_prices") or result.get("offers") or [],
            "is_anomaly": is_anomaly,
            "metadata": {
                "scan_task_id": scan_task_id,
                "batch_id": batch_id,
                "source": source,
            },
        }

        try:
            # 1. Log Price Entry
            self.admin_insforge.table("price_logs").insert(log_entry).execute()

            # 2. Update Hotel Metadata (Whole Package)
            # Fetch existing sentiment for Smart Memory merge
            try:
                existing_res = (
                    self.admin_insforge.table("hotels")
                    .select("sentiment_breakdown")
                    .eq("id", hotel_id)
                    .maybe_single()
                    .execute()
                )
                existing_sentiment = (
                    cast(Dict[str, Any], existing_res.data or {}).get("sentiment_breakdown")
                    if existing_res else []
                ) or []
            except Exception:
                existing_sentiment = []

            from backend.utils.sentiment_utils import merge_sentiment_breakdowns

            new_sentiment = result.get("sentiment_breakdown") or []
            merged_sentiment = merge_sentiment_breakdowns(
                existing_sentiment, new_sentiment
            )

            hotel_update = {
                "rating": result.get("rating"),
                "review_count": self._extract_review_count(result),
                "stars": result.get("stars"),
                "description": result.get("description"),
                "amenities": result.get("amenities"),
                "image_url": result.get("image_url"),
                "images": result.get("images"),
                "rating_distribution": result.get("rating_distribution"),
                "check_in_time": result.get("check_in_time"),
                "check_out_time": result.get("check_out_time"),
                "sentiment_breakdown": merged_sentiment,
                "room_types": current_room_types,
                "currency": result.get("currency"),
            }
            # Add phone, website etc if present
            for field in ["phone", "website", "address", "latitude", "longitude"]:
                if result.get(field):
                    hotel_update[field] = result[field]

            # Filter out None values to avoid overwriting existing data with null
            hotel_update = {k: v for k, v in hotel_update.items() if v is not None}
            if hotel_update:
                self.admin_insforge.table("hotels").update(hotel_update).eq(
                    "id", hotel_id
                ).execute()

            # 3. Log Sentiment History
            if result.get("sentiment_breakdown"):
                sentiment_entry = {
                    "hotel_id": hotel_id,
                    "rating": result.get("rating"),
                    "review_count": self._extract_review_count(result),
                    "sentiment_breakdown": result.get("sentiment_breakdown"),
                    "recorded_at": datetime.now(timezone.utc).isoformat(),
                }
                self.admin_insforge.table("sentiment_history").insert(
                    sentiment_entry
                ).execute()

            # 4. Update Room Type Catalog
            if result.get("room_catalog"):
                # DataForSEO Advanced returns detailed room catalog
                await self.update_room_type_catalog(hotel_id, result["room_catalog"])
            elif result.get("items"):
                # DataForSEO returns individual items with more detail (OTA info etc)
                await self.update_room_type_catalog(hotel_id, result["items"])
            elif result.get("room_types"):
                # Fallback to simple strings if no rich items
                simple_rooms = [{"name": r} for r in result["room_types"]]
                await self.update_room_type_catalog(hotel_id, simple_rooms)

            return {"status": "success", "price": price, "is_anomaly": is_anomaly}
        except Exception as e:
            logger.error(f"Sync persistence failed for {hotel_id}: {e}")
            return {"status": "error", "error": str(e)}

    async def _fetch_history_map(
        self, hotel_ids: List[str]
    ) -> Dict[str, List[Dict[str, Any]]]:
        history_map = {}
        try:
            # 5-Day Variance Window: We fetch all history for these hotels from exactly 5 days ago
            # This ensures the 30% variance check is based on time, not a random row count.
            five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)
            
            res = (
                self.admin_insforge.table("price_logs")
                .select(
                    "hotel_id, price, currency, recorded_at, check_in_date, vendor, parity_offers, room_types, metadata, is_anomaly"
                )
                .in_("hotel_id", hotel_ids)
                .gte("recorded_at", five_days_ago.isoformat())
                .order("recorded_at", desc=True)
                .execute()
            )

            for item in cast(List[Dict[str, Any]], res.data or []):
                hid = item["hotel_id"]
                if hid not in history_map:
                    history_map[hid] = []
                history_map[hid].append(item)
        except Exception as e:
            logger.error(f"Failed to fetch history map: {e}")
        return history_map

    async def _fetch_hotel_metadata_map(
        self, hotel_ids: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        metadata_map = {}
        try:
            res = (
                self.admin_insforge.table("hotels")
                .select("id, name, min_price_floor, currency")
                .in_("id", hotel_ids)
                .execute()
            )

            for hotel in cast(List[Dict[str, Any]], res.data or []):
                metadata_map[str(hotel["id"])] = hotel
        except Exception as e:
            logger.error(f"Failed to fetch hotel metadata: {e}")
        return metadata_map

    async def _process_hotel_entry(
        self,
        user_id: UUID,
        result: Dict[str, Any],
        history: List[Dict[str, Any]],
        metadata: Dict[str, Any],
        threshold: float,
        options: Optional[ScanOptions],
        session_id: Optional[UUID],
        log_reasoning_fn,
        action_type: str = "monitor",
    ) -> Dict[str, Any]:
        hotel_id = result.get("hotel_id")
        price_data = cast(Dict[str, Any], result.get("price_data") or {})
        status = result.get("status")

        raw_price = price_data.get("price") or result.get("price")
        current_price = float(raw_price) if raw_price is not None else 0.0
        currency = str(price_data.get("currency") or result.get("currency") or metadata.get("currency") or "TRY")
        hotel_name = metadata.get("name", "")

        # 1. Price Validation (Kaizen 2026: Tiered Sanity Check)
        is_valid = True

        # A. Minimum Floor Safeguard (User Insight 2026)
        # 1. Check manual floor from DB
        floor = float(metadata.get("min_price_floor") or 0)
        # 2. Heuristic for Brands (e.g. Ramada > 3000)
        if floor == 0:
            brand_floors = {
                "ramada": 500.0,
                "hilton": 1000.0,
                "sheraton": 1000.0,
                "marriott": 1000.0,
                "wyndham": 500.0,
                "holiday inn": 500.0,
            }
            lower_name = hotel_name.lower()
            for brand, brand_floor in brand_floors.items():
                if brand in lower_name:
                    floor = brand_floor
                    break
        # 3. Global absolute minimum
        if floor == 0:
            floor = 200.0

        if current_price > 0:

            # Check against TRY floor, converting current price to TRY for accurate validation
            comp_price = convert_currency(current_price, currency, "TRY") if currency != "TRY" else current_price
            if comp_price < floor:
                if log_reasoning_fn:
                    await log_reasoning_fn(
                        session_id,
                        "Safeguard",
                        f"REJECTED: Price {current_price} {currency} (Normalized: {comp_price:.2f} TRY) is below floor ({floor} TRY) for '{hotel_name}'.",
                        "warning",
                    )
                current_price = 0.0
                is_valid = False

        # B. 30% Variance Safeguard
        if is_valid and current_price > 0:
            avg_baseline = 0.0
            # Normalize historical prices to current currency for consistent variance baseline
            recent_valid = []
            for h in history:
                h_price = float(h.get("price") or 0)
                if h_price > 0:
                    h_curr = str(h.get("currency") or "TRY")
                    norm_h_price = convert_currency(h_price, h_curr, currency) if h_curr != currency else h_price
                    recent_valid.append(norm_h_price)
            if recent_valid:
                avg_baseline = sum(recent_valid) / len(recent_valid)
                # REJECT if price deviates by more than 50% from verified baseline
                # [KAIZEN 2026] Relaxed from 30% to 50% for high-inflation/volatile markets
                lower_bound = avg_baseline * 0.5
                upper_bound = avg_baseline * 1.5

                if current_price < lower_bound or current_price > upper_bound:
                    if log_reasoning_fn:
                        await log_reasoning_fn(
                            session_id,
                            "Safeguard",
                            f"REJECTED: Price {current_price} {currency} deviates {((current_price/avg_baseline)-1)*100:.1f}% from baseline ({avg_baseline:.2f} {currency}). Window: 50%.",
                            "warning",
                        )
                    current_price = 0.0
                    is_valid = False

        # Normalization
        target_currency = getattr(options, "currency", None) if options else None
        if not target_currency:
            target_currency = metadata.get("currency") or "USD"
        if current_price > 0 and currency != target_currency:
            current_price = convert_currency(current_price, currency, target_currency)
            currency = target_currency

        # 2. Smart Continuity
        is_estimated = False
        check_in = result.get("check_in") or (
            date.today()
            if options is None
            else getattr(options, "check_in", date.today())
        )
        check_in_str = str(check_in)

        if current_price <= 0:
            now = datetime.now(timezone.utc)
            max_age = timedelta(hours=24) # Kaizen: Tightened fallback window to 24h

            def is_recent(h):
                rec = h.get("recorded_at")
                if not rec: return False
                try:
                    # Handle both datetime objects and ISO strings
                    dt = rec if isinstance(rec, datetime) else datetime.fromisoformat(str(rec).replace('Z', '+00:00'))
                    return (now - dt) <= max_age
                except Exception: return False

            # Level 1: Same check-in date + Recency Check
            fallback = next(
                (h for h in history if str(h.get("check_in_date")) == check_in_str and is_recent(h)),
                None,
            )
            if fallback:
                fallback_price = float(fallback.get("price") or 0)
                fallback_curr = str(fallback.get("currency") or "TRY")
                # Convert historical price to TRY to validate against system floor sanity
                fb_comp = convert_currency(fallback_price, fallback_curr, "TRY") if fallback_curr != "TRY" else fallback_price
                
                # [KAIZEN 2026] Only fallback if the historical price is itself sane
                if fb_comp >= max(floor, 100.0):
                    current_price = fallback_price
                    currency = str(fallback["currency"])
                    is_estimated = True
                    if log_reasoning_fn:
                        await log_reasoning_fn(
                            session_id,
                            "Continuity",
                            f"Live scan failed/rejected. Falling back to sane historical price: {current_price} {currency}.",
                            "info",
                        )
                else:
                    if log_reasoning_fn:
                        await log_reasoning_fn(
                            session_id,
                            "Continuity",
                            f"Live scan failed/rejected AND historical fallback {fallback_price} is polluted. Result discarded.",
                            "error",
                        )
                    current_price = 0.0

        # 3. Market Depth & Room Persistence
        offers = (
            result.get("ota_prices") or 
            result.get("offers") or 
            result.get("parity_offers") or 
            result.get("all_prices") or 
            price_data.get("offers") or 
            price_data.get("prices") or 
            []
        )
        is_shallow = len(offers) < 5 and not is_estimated

        # [FIX 2026-05-10] OTA Protection: Detect thin price_search results
        # (Mirroring logic from batch_sync_extraction_results to prevent 4-hourly price updates
        # from wiping out richer weekly hotel_info OTA offers and room catalogs.)
        task_type = result.get("task_type") or price_data.get("task_type")
        is_price_search = task_type == "price_search"
        is_thin_offers = (
            len(offers) <= 1
            and all(
                (o.get("source") or "").lower() in ["direct search", "direct", ""]
                for o in offers
            )
        ) if offers else True
        
        should_protect_ota = is_price_search and is_thin_offers

        # Room Types Priority: Prefer rich catalog objects over simple string names
        # KAİZEN 2026: Use unified normalization helper to prevent "Target Chamber" UI bug
        current_room_types = self._normalize_room_types(
            result.get("room_catalog") or 
            price_data.get("room_types") or 
            price_data.get("all_rooms") or 
            []
        )
        
        # If room_types is empty, try to derive from offers/prices
        if not current_room_types and offers:
            current_room_types = [
                {"name": of.get("name") or of.get("room_type"), "price": of.get("price")} 
                for of in offers if of.get("name") or of.get("room_type")
            ]
        # Kaizen: Disabled carry-forward room type fallbacks to prevent data pollution as requested.
        # Only room types from the current scan (or derived from current offers) will be persisted.

        # 4. Metadata & Sentiment
        meta_update = {
            "last_scan": datetime.now(timezone.utc).isoformat(),
            "vendor_source": price_data.get("vendor") or price_data.get("source") or price_data.get("site") or price_data.get("ota_name") or "Provider",
        }

        # Only update the 'live' price if we have a fresh, valid one
        if current_price > 0 and not is_estimated:
            meta_update["current_price"] = current_price

        # KAİZEN: Smart Update Logic for Static Fields
        # We fetch existing state to avoid redundant writes for stable data (descriptions, amenities, etc.)
        hotel_data_res = (
            self.insforge.table("hotels")
            .select(
                "sentiment_breakdown, reviews, description, amenities, images, phone, website, address, stars, latitude, longitude, room_types, updated_at"
            )
            .eq("id", hotel_id)
            .maybe_single()
            .execute()
        )

        current_hotel = cast(Dict[str, Any], hotel_data_res.data if hotel_data_res and hotel_data_res.data else {})
        existing_breakdown = (
            current_hotel.get("sentiment_breakdown") if current_hotel else []
        ) or []

        is_sentiment_modified = False
        if "reviews_breakdown" in price_data:
            merged = merge_sentiment_breakdowns(
                existing_breakdown, price_data["reviews_breakdown"]
            )
            meta_update["sentiment_breakdown"] = merged
            meta_update["guest_mentions"] = generate_mentions(merged)
            is_sentiment_modified = True

        # Store raw review snippets if present (usually from Deep Scans)
        if (
            "reviews" in price_data
            and isinstance(price_data["reviews"], list)
            and len(price_data["reviews"]) > 0
        ):
            meta_update["reviews"] = price_data["reviews"]

        # Dynamic Fields (Update every time)
        for field in ["rating", "review_count"]:
            if price_data.get(field) is not None:
                meta_update[field] = price_data[field]

        # Static/Semi-Static Fields (Smart Update)
        # Only update if missing OR if last update was > 30 days ago
        last_updated_str = current_hotel.get("updated_at")
        is_stale = False
        if last_updated_str:
            try:
                # Handle potential Z or +00:00 suffix
                ts_str = last_updated_str.replace("Z", "+00:00")
                last_ts = datetime.fromisoformat(ts_str)
                if datetime.now(timezone.utc) - last_ts > timedelta(days=30):
                    is_stale = True
            except Exception:
                is_stale = True  # Fallback to update if parsing fails

        static_fields = [
            "description",
            "amenities",
            "images",
            "phone",
            "website",
            "address",
            "stars",
            "latitude",
            "longitude",
            "room_types",
            "check_in_time",
            "check_out_time",
            "currency",
        ]
        for field in static_fields:
            new_val = price_data.get(field)
            if field == "room_types":
                # [KAIZEN 2026] Use normalized room types pre-calculated above
                new_val = current_room_types
            if not new_val:
                continue

            existing_val = current_hotel.get(field)
            should_update = False

            if not existing_val or is_stale:
                should_update = True
            elif (
                field == "description"
                and len(str(new_val)) > len(str(existing_val or "")) * 1.2
            ):
                # Significant description improvement (>20% longer)
                should_update = True
            elif (
                field == "amenities"
                and isinstance(new_val, list)
                and len(new_val) > len(existing_val or [])
            ):
                # More amenities found
                should_update = True
            elif (
                field == "room_types" and isinstance(new_val, list) and len(new_val) > 0
            ):
                # [FIX 2026-05-10] Protect existing rich room types if current scan is a thin price search
                if should_protect_ota and current_hotel and current_hotel.get("room_types"):
                    should_update = False
                else:
                    should_update = True
            elif field == "currency" and new_val != existing_val:
                # Force update currency if it changed (e.g. was None or different)
                should_update = True

            if should_update:
                meta_update[field] = new_val

        # [FIX 2026-05-10] Write back aggregated offers if not protected
        if offers and not should_protect_ota:
            meta_update["offers"] = copy.deepcopy(offers)
            meta_update["parity_offers"] = copy.deepcopy(
                result.get("parity_offers") or 
                price_data.get("parity_offers") or 
                offers
            )
            meta_update["market_offers"] = copy.deepcopy(
                result.get("market_offers") or 
                price_data.get("market_offers") or 
                offers
            )

        # Update DB using admin_db for background reliability
        if meta_update:
            try:
                self.admin_insforge.table("hotels").update(meta_update).eq(
                    "id", hotel_id
                ).execute()
            except Exception as e:
                logger.error(f"[Persistence] Failed to update hotel {hotel_id}: {e}")
                # We don't raise here; failing to update the metadata shouldn't stop pricing logs

        # 5. Alert & Volatility
        alert = None
        volatility = 0.0
        if current_price > 0:
            volatility = await predictive_service.calculate_market_volatility(
                self.insforge, UUID(str(hotel_id))
            )
            active_threshold = predictive_service.get_smart_threshold(
                threshold, volatility
            )

            last_price = float(history[0]["price"]) if history else 0.0
            if last_price > 0:
                breach = price_comparator.check_threshold_breach(
                    current_price, last_price, active_threshold
                )
                if breach:
                    alert = {"user_id": str(user_id), "hotel_id": hotel_id, **breach}

        # 6. Prepare Outputs
        # Ensure check_in is a date/datetime object for timedelta arithmetic
        if isinstance(check_in, str):
            try:
                check_in = date.fromisoformat(check_in)
            except ValueError:
                check_in = datetime.fromisoformat(check_in).date()

        check_out = result.get("check_out") or (check_in + timedelta(days=1))
        check_out_str = str(check_out)

        price_log = {
            "hotel_id": hotel_id,
            "price": current_price,
            "currency": currency,
            "check_in_date": check_in_str,
            "check_out_date": check_out_str,
            "is_estimated": is_estimated,
            "session_id": str(session_id) if session_id else None,
            "vendor": price_data.get("vendor") or price_data.get("source") or price_data.get("site") or price_data.get("ota_name") or "Provider",
            "parity_offers": result.get("parity_offers") or offers,
            "offers": result.get("offers") or price_data.get("offers") or offers,
            "room_types": current_room_types,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "is_deep_scan": result.get("is_deep_scan", False),
            "market_offers": result.get("all_prices") or result.get("ota_prices") or price_data.get("all_prices") or price_data.get("offers") or offers or [],
            "metadata": {"is_shallow": is_shallow, "extraction_depth": len(offers)},
        }

        sentiment_history = None
        if is_sentiment_modified:
            sentiment_history = {
                "hotel_id": hotel_id,
                "rating": meta_update.get("rating"),
                "review_count": meta_update.get("review_count"),
                "sentiment_breakdown": meta_update.get("sentiment_breakdown"),
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }

        # EXPLANATION: Normalizing Scraped Reviews (Kaizen 2026)
        # We transform raw SerpApi review objects into our schema-compliant format.
        # This includes generating synthetic but stable IDs if missing, and
        # flattening category ratings (e.g. 'Cleanliness') for analytics.
        rich_reviews = []
        # [FIX 2026-04-30] Check reviews_list first (flat list from hotel_info parser),
        # then fall back to reviews only if it's actually a list (not an integer vote count).
        raw_reviews = price_data.get("reviews_list") or (
            price_data.get("reviews") if isinstance(price_data.get("reviews"), list) else None
        ) or []
        if raw_reviews and isinstance(raw_reviews, list):
            import uuid

            for r in raw_reviews:
                if not isinstance(r, dict):
                    continue
                # Map SerpApi/DataForSEO fields to our DB schema
                review_obj = {
                    "hotel_id": hotel_id,
                    "external_id": r.get("id") or str(uuid.uuid4()),
                    "author": r.get("title") or r.get("author", "Anonymous"),
                    "rating": r.get("rating", 0),
                    "text": r.get("snippet") or r.get("review_text") or r.get("text") or "",
                    "recorded_at": datetime.now(timezone.utc).isoformat(),
                    "review_date": self._parse_relative_date(
                        r.get("date") or r.get("review_date")
                    ),
                }
                rich_reviews.append(review_obj)

        # [ROBUST] Update property-level metadata (Shared across users)
        # We use admin_db to ensure these updates persist even if RLS would block this user
        # from updating a shared record (which depends on specific RLS policies).
        self.admin_insforge.table("hotels").update(
            {"last_scanned_at": datetime.now().isoformat()}
        ).eq("id", hotel_id).execute()

        return {
            "price_log": price_log,
            "query_log": {
                "user_id": str(user_id),
                "session_id": str(session_id) if session_id else None,
                "hotel_name": result.get("hotel_name", "Unknown"),
                "location": result.get("location"),
                "status": "success" if result.get("status") == "success" else "failed",
                "status_detail": result.get("error"),
                "price": price_log["price"] if price_log["price"] > 0 else None,
                "currency": price_log["currency"],
                "vendor": price_log["vendor"],
                "check_in_date": price_log["check_in_date"],
                "room_types": price_log["room_types"],
                "sentiment_summary": meta_update.get("sentiment_breakdown"),
                "action_type": action_type,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            "sentiment_history": sentiment_history,
            "rich_reviews": rich_reviews,
            "alert": alert,
            "volatility": volatility,
            "embedding_task": (hotel_id, meta_update)
            if is_sentiment_modified
            else None,
        }

    async def _process_embeddings(self, queue, session_id, log_reasoning_fn):
        """Processes queued embeddings in parallel."""
        tasks = []
        for hotel_id, meta in queue:
            tasks.append(self._update_sentiment_embedding(hotel_id, meta))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        # Update status in DB
        for i, res in enumerate(results):
            hid, _ = queue[i]
            status = "current" if res is True else "failed"
            self.admin_insforge.table("hotels").update({"embedding_status": status}).eq(
                "id", hid
            ).execute()

        if log_reasoning_fn:
            await log_reasoning_fn(
                session_id,
                "Analysis",
                f"[Embedding] Parallel processing complete for {len(tasks)} profiles.",
                "info",
            )

    async def _update_sentiment_embedding(
        self, hotel_id: str, meta: Dict[str, Any]
    ) -> bool:
        # Simplified version of the analyst logic
        try:
            name = meta.get("name", "Hotel")
            parts = [f"Hotel: {name}"]
            if meta.get("sentiment_breakdown"):
                parts.append(f"Sentiment: {str(meta['sentiment_breakdown'])[:500]}")

            profile = "\n".join(parts)
            embedding = await get_embedding(profile)
            if embedding:
                self.admin_insforge.table("hotels").update(
                    {"sentiment_embedding": embedding}
                ).eq("id", hotel_id).execute()
                return True
        except Exception:
            pass
        return False

    def _parse_relative_date(self, date_str: Optional[str]) -> str:
        """
        Robust relative date parser for SerpApi strings (En/Tr).
        Example inputs: "3 months ago", "2 hafta önce", "vorgestern", etc.
        """
        # [KAIZEN 2026] Fuzzy Date Normalization
        # SerpApi returns localized strings based on the 'hl' parameter.
        # This helper ensures PostgreSQL dates are always valid.

        if not date_str or not isinstance(date_str, str):
            return date.today().isoformat()

        now = date.today()
        ds = date_str.lower()

        try:
            # 1. Look for numbers
            matches = re.findall(r"(\d+)", ds)
            val = int(matches[0]) if matches else 1

            # 2. Years
            if any(x in ds for x in ["yıl", "year", "ann"]):
                return (now - timedelta(days=val * 365)).isoformat()

            # 3. Months (approximate 30 days)
            if any(x in ds for x in ["ay", "month", "mois"]):
                return (now - timedelta(days=val * 30)).isoformat()

            # 4. Weeks
            if any(x in ds for x in ["hafta", "week", "semaine"]):
                return (now - timedelta(days=val * 7)).isoformat()

            # 5. Days
            if any(x in ds for x in ["gün", "day", "jour", "hier", "dün"]):
                return (now - timedelta(days=val)).isoformat()

            # Fallback check for ISO-like strings
            if re.match(r"\d{4}-\d{2}-\d{2}", date_str):
                return date_str

        except Exception:
            pass

        return now.isoformat()

    async def batch_sync_extraction_results(
        self, batch_items: List[Dict[str, Any]], source: str = "DataForSEO_Batch"
    ) -> Dict[str, Any]:
        """
        High-Performance Batch Sync.
        Groups results by property_token (identity) to perform bulk updates across variations.
        """
        if not batch_items:
            return {"synced_hotel_ids": [], "notification_events": [], "analysis_payload": []}

        now_ts = datetime.now(timezone.utc).isoformat()
        
        # 1. Map Hotel IDs to Identity (property_token or id)
        input_h_ids = list(set(str(item["hotel_id"]) for item in batch_items))
        hotels_lookup_res = (
            self.admin_insforge.table("hotels")
            .select("id, property_token, name, location")
            .in_("id", input_h_ids)
            .execute()
        )
        hotel_ref_map: Dict[str, Dict[str, Any]] = {
            str(h["id"]): h for h in cast(List[Dict[str, Any]], hotels_lookup_res.data or [])
        }
        
        # 1b. Bulk Fetch Price History for 5-Day Variance Baseline
        # Uses shared _fetch_history_map to ensure consistency across all sync paths
        history_map = await self._fetch_history_map(input_h_ids)
        
        # 2. Group and Merge Results by Identity
        # Identity is property_token if exists, otherwise hotel_id
        identity_groups = {} # identity -> { merged_res, task_ids, hotel_ids, task_types }
        
        for item in batch_items:
            hid = str(item["hotel_id"])
            h_ref = hotel_ref_map.get(hid)
            if not h_ref:
                continue  # Hotel not found in DB
            
            identity = h_ref.get("property_token") or hid
            task_id = item.get("scan_task_id")
            task_type = item.get("task_type")  # [FIX 2026-05-10] Track task_type for OTA protection
            res = item.get("result", {})
            if not res or res.get("status") != "success":
                continue

            logger.debug(f"Processing identity {identity}. room_types: {len(res.get('room_types', []))}, room_catalog: {len(res.get('room_catalog', []))}, offers: {len(res.get('offers', []))}")
            
            if identity not in identity_groups:
                identity_groups[identity] = {
                    "res": res, 
                    "task_ids": [task_id] if task_id else [],
                    "hotel_ids": {hid},
                    "task_types": {task_type} if task_type else set()
                }
            else:
                group = identity_groups[identity]
                group["hotel_ids"].add(hid)
                if task_id:
                    group["task_ids"].append(task_id)
                if task_type:
                    group["task_types"].add(task_type)
                
                # Smart merge: Priority on BEST (lowest) price and deeper metadata
                existing = group["res"]
                for key, val in res.items():
                    if not val:
                        continue
                    
                    if key in ["price", "best_price"]:
                        new_p = float(val) if val else 0
                        old_p = float(existing.get(key) or 0)
                        if new_p > 0:
                            # If we have no old price, or new price is better (lower)
                            if old_p == 0 or new_p < old_p:
                                existing[key] = new_p
                    elif key in ["offers", "ota_prices", "room_catalog", "room_types", "market_offers", "parity_offers", "all_prices"]:
                        # Merge lists and deduplicate by 'source', 'title', or 'name'
                        existing_list = existing.get(key) or []
                        if not isinstance(existing_list, list):
                            existing_list = []
                        if isinstance(val, list):
                            seen = set()
                            combined = []
                            for entry in (existing_list + val):
                                # Support both dicts (offers/rooms) and primitives (strings)
                                if not isinstance(entry, dict):
                                    if entry not in seen:
                                        combined.append(entry)
                                        seen.add(entry)
                                    continue
                                    
                                # Use source+price+identity as unique key
                                # We check multiple common keys for the 'title' part
                                it_title = (
                                    entry.get('title') or 
                                    entry.get('name') or 
                                    entry.get('room_name') or 
                                    entry.get('description') or 
                                    ""
                                )
                                it_source = entry.get('source') or entry.get('vendor') or "unknown"
                                it_price = entry.get('price') or entry.get('price_raw') or 0
                                
                                ident = f"{it_source}_{it_price}_{it_title}"
                                if ident not in seen:
                                    combined.append(entry)
                                    seen.add(ident)
                            existing[key] = combined
                    elif not existing.get(key) or (isinstance(val, (list, dict)) and len(str(val)) > len(str(existing.get(key)))):
                        existing[key] = val

        # 3. Discover All Variations for Identities
        tokens = [k for k in identity_groups.keys() if not k.isdigit()] # Heuristic: tokens are UUIDs/strings, IDs are numeric strings
        # Actually, tokens and IDs can both be strings. Let's just use tokens we found.
        found_tokens = list(set(h["property_token"] for h in hotel_ref_map.values() if h.get("property_token")))
        
        variations_map: Dict[str, List[Dict[str, Any]]] = {} # identity -> [hotel_records]
        if found_tokens:
            v_res = (
                self.admin_insforge.table("hotels")
                .select("id, property_token, name, location")
                .in_("property_token", found_tokens)
                .execute()
            )
            for v in cast(List[Dict[str, Any]], v_res.data or []):
                tok = v["property_token"]
                if tok not in variations_map:
                    variations_map[tok] = []
                variations_map[tok].append(v)
        
        # 4. Prepare Vectorized Payloads
        hotel_updates = []
        price_logs: List[Dict[str, Any]] = []
        sentiment_history = []
        hotel_reviews = []
        raw_archives = []
        analysis_payload = []
        notification_events = []
        completed_task_ids = []
        
        for identity, group in identity_groups.items():
            res_data = group["res"]
            
            # [FIX 2026-04-25] Robust Price & Offer Extraction
            # We look for various price/offer fields from both agent response and DataForSEO raw data.
            price = float(res_data.get("price") or res_data.get("best_price") or 0)
            offers = (
                res_data.get("offers") or 
                res_data.get("ota_prices") or 
                res_data.get("parity_offers") or 
                res_data.get("all_prices") or 
                res_data.get("prices") or 
                []
            )

            # [FIX 2026-04-30] Extract stay dates for accurate Rate Spread analysis
            check_in = res_data.get("check_in_date") or res_data.get("check_in")
            check_out = res_data.get("check_out_date") or res_data.get("check_out")
            
            if price == 0 and offers:
                # Derive price from cheapest OTA if top-level is missing
                try:
                    price = min(float(p.get("price") or 999999) for p in offers)
                    if price == 999999:
                        price = 0
                except Exception:
                    price = 0
            
            currency = res_data.get("currency") or "TRY"

            # [KAIZEN 2026] Dynamic Anomaly Detection (Standard Deviation + Variance)
            # Calculate shift against 5-day rolling average with confidence intervals
            is_anomaly = False
            anomaly_details = {}
            first_h_id = list(group["hotel_ids"])[0]
            hist = history_map.get(first_h_id, [])
            
            # Filter out previous anomalies and zeros for a clean baseline
            recent_valid = [
                float(h["price"])
                for h in hist
                if h.get("price") is not None and float(h["price"]) > 0 and not h.get("is_anomaly", False)
            ]
            
            if recent_valid and price > 0:
                avg_baseline = sum(recent_valid) / len(recent_valid)
                
                # Dynamic Threshold: Use StdDev if we have enough samples (N>3)
                if len(recent_valid) > 3:
                    std_dev = statistics.stdev(recent_valid)
                    # Z-Score check: Reject if price is > 3 sigma or > 50% shift
                    z_score = abs(price - avg_baseline) / (std_dev or 1)
                    if z_score > 3 or abs(price - avg_baseline) / avg_baseline > 0.5:
                        is_anomaly = True
                        anomaly_details = {"z_score": round(z_score, 2), "std_dev": round(std_dev, 2)}
                else:
                    # Fallback: REJECT if price deviates by more than 50% from verified baseline
                    # [KAIZEN 2026] Relaxed from 30% to 50% for consistency
                    lower_bound = avg_baseline * 0.5
                    upper_bound = avg_baseline * 1.5
                    if price < lower_bound or price > upper_bound:
                        is_anomaly = True
                        anomaly_details = {"fixed_threshold": 0.5}

                if is_anomaly:
                    logger.warning(
                        f"Anomaly Detected for {first_h_id}: Price {price} vs Baseline {avg_baseline}. "
                        f"Details: {anomaly_details}"
                    )
                else:
                    anomaly_details = None
            else:
                anomaly_details = None
            
            # Determine targets: All variations if identity is a token, else just the single hotel
            targets = variations_map.get(identity)
            if not targets:
                # Fallback: if identity is an ID, find it in hotel_ref_map
                targets = [hotel_ref_map.get(identity)] if hotel_ref_map.get(identity) else []
            
            if not targets:
                continue
            
            # Prepare Analysis Payload (once per identity)
            analysis_item = res_data.copy()
            analysis_item.update({"identity": identity, "targets_count": len(targets)})
            analysis_payload.append(analysis_item)
            
            for target in targets:
                if not target:
                    continue
                tid = str(target["id"])
                
                # Hotel Update Payload
                upd: Dict[str, Any] = {
                    "id": tid,
                    "last_scanned_at": now_ts
                }
                
                # [FIX] Only update current_price if we actually found a positive price.
                # This prevents hotel_info (or failed scans) from overwriting valid prices with NULL.
                if price > 0:
                    upd["current_price"] = price
                
                # Map rich metadata
                metadata_fields = [
                    "rating", "stars", "description", "amenities", "check_in_time", 
                    "check_out_time", "sentiment_breakdown", "latitude", "longitude",
                    "phone", "website", "address", "image_url", "rating_distribution",
                    "guest_mentions", "images", "other_sites_reviews"
                ]
                for field in metadata_fields:
                    if res_data.get(field):
                        upd[field] = res_data[field]
                
                # Reviews & OTA Summary
                rev_cnt = self._extract_review_count(res_data)
                if rev_cnt is not None:
                    upd["review_count"] = rev_cnt

                # [KAIZEN 2026] Extract full list of offers using all possible keys
                offers: List[Dict[str, Any]] = (
                    res_data.get("offers")
                    or res_data.get("ota_prices")
                    or res_data.get("parity_offers")
                    or res_data.get("all_prices")
                    or res_data.get("prices")
                    or []
                )

                # [FIX 2026-05-10] OTA Protection: Detect thin price_search results
                # price_search tasks only return a single "Direct Search" price.
                # If that's all we have, do NOT overwrite richer hotel_info OTA data
                # already in the database. This prevents the 4-hourly price_search
                # from erasing multi-OTA data that hotel_info provides weekly.
                group_task_types = group.get("task_types", set())
                is_price_search_only = (
                    group_task_types == {"price_search"}
                    or (len(group_task_types) == 1 and "price_search" in group_task_types)
                )
                is_thin_offers = (
                    len(offers) <= 1
                    and all(
                        (o.get("source") or "").lower() in ["direct search", "direct", ""]
                        for o in offers
                    )
                ) if offers else True  # Empty offers = thin
                
                should_protect_ota = is_price_search_only and is_thin_offers
                
                if should_protect_ota:
                    logger.info(
                        f"[OTA Protection] Skipping market_offers/room_types update for {tid} — "
                        f"thin price_search result ({len(offers)} offers, sources: "
                        f"{[o.get('source') for o in offers]})"
                    )

                if offers and not should_protect_ota:
                    upd["reviews"] = {
                        "ota_count": len(offers),
                        "ota_min_price": min(
                            (p.get("price") or 999999) for p in offers
                        ),
                        "ota_sources": list(
                            set(p.get("source") for p in offers if p.get("source"))
                        ),
                    }
                    # [FIX 2026-05-02] Deep-copy offers for hotel update to prevent
                    # SDK .update() from mutating the original list reference.
                    upd["offers"] = copy.deepcopy(offers)
                    upd["parity_offers"] = copy.deepcopy(res_data.get("parity_offers") or offers)
                    upd["market_offers"] = copy.deepcopy(res_data.get("market_offers") or offers)
                
                # Room Types Fallback — also protected from thin price_search
                room_types = self._normalize_room_types(
                    res_data.get("room_catalog") or 
                    res_data.get("room_types") or 
                    res_data.get("all_rooms") or 
                    []
                )
                if room_types and not should_protect_ota:
                    upd["room_types"] = room_types
                
                hotel_updates.append(upd)
                
                # Price Log (Insert)
                # [FIX] Log if we have a price OR if we have OTA offers (even if price is 0, though unlikely now)
                if price > 0 or offers:
                    # Determine vendor name for this log
                    log_vendor = (
                        res_data.get("vendor") or 
                        res_data.get("source") or 
                        res_data.get("site") or 
                        res_data.get("ota_name") or 
                        source or 
                        "Provider"
                    )

                    # [FIX 2026-05-02] Deep-copy offers for price_log isolation.
                    # Hotel updates execute before price_log inserts, so any SDK mutation
                    # of the shared list references would cause empty arrays in price_logs.
                    safe_offers = copy.deepcopy(offers) if offers else []
                    safe_room_types = copy.deepcopy(room_types) if room_types else []

                    price_logs.append({
                        "hotel_id": tid,
                        "price": price,
                        "currency": currency,
                        "check_in_date": check_in,
                        "check_out_date": check_out,
                        "vendor": log_vendor,
                        "source": source,
                        "parity_offers": safe_offers,
                        "market_offers": copy.deepcopy(res_data.get("market_offers") or offers),
                        "offers": safe_offers,
                        "room_types": safe_room_types,
                        "recorded_at": now_ts,
                        "is_anomaly": is_anomaly,
                        "metadata": {"anomaly_details": anomaly_details} if is_anomaly else None
                    })

                    # [KAIZEN 2026] Individual Reviews (Insert)
                    # We extract the full list of reviews (if present) for detailed feedback analysis
                    scraped_reviews = res_data.get("reviews_list") or res_data.get("reviews")
                    if isinstance(scraped_reviews, list) and scraped_reviews:
                        import uuid
                        for r in scraped_reviews:
                            if not isinstance(r, dict):
                                continue
                            # We only care about reviews with content or a rating
                            if not r.get("text") and not r.get("rating") and not r.get("review_text"):
                                continue

                            hotel_reviews.append({
                                "hotel_id": tid,
                                "external_id": str(r.get("id") or r.get("review_id") or uuid.uuid4()),
                                "author": r.get("author") or r.get("title") or "Anonymous",
                                "rating": r.get("rating"),
                                "text": r.get("text") or r.get("snippet") or r.get("review_text") or "",
                                "review_date": self._parse_relative_date(r.get("date") or r.get("review_date")),
                                "recorded_at": now_ts,
                                "metadata": {k: v for k, v in r.items() if k not in ["author", "rating", "text", "date", "id", "review_text", "review_id"]}
                            })
                
                # Sentiment History
                if res_data.get("sentiment_breakdown"):
                    sentiment_history.append({
                        "hotel_id": tid,
                        "rating": res_data.get("rating"),
                        "review_count": self._extract_review_count(res_data),
                        "sentiment_breakdown": res_data.get("sentiment_breakdown"),
                        "recorded_at": now_ts
                    })

            # Notification Event (per identity)
            if price > 0:
                notification_events.append({
                    "hotel_id": list(group["hotel_ids"])[0],
                    "price": price,
                    "currency": currency,
                    "property_token": identity if not identity.isdigit() else None,
                    "parity_offers": res_data.get("offers") or [],
                    "is_anomaly": is_anomaly
                })
            
            # Archive raw results
            for tid in group["task_ids"]:
                completed_task_ids.append(tid)
                if res_data.get("raw_data"):
                    raw_archives.append({
                        "id": tid, 
                        "raw_results": res_data["raw_data"],
                        "status": "completed"
                    })

        # 5. Execute Batch Operations
        if hotel_updates:
            for upd in hotel_updates:
                hotel_id = upd.pop("id")
                self.admin_insforge.table("hotels").update(upd).eq("id", hotel_id).execute()
        
        # 6. Finalize Transactional Insertions
        if hotel_reviews:
            logger.info(f"[Sync] Persisting {len(hotel_reviews)} individual reviews.")
            await self._resilient_insert("hotel_reviews", hotel_reviews)

        if price_logs:
            # Production-level summary logging
            total_offers = sum(len(pl.get('offers', [])) for pl in price_logs)
            logger.info(
                f"[Sync] Inserting {len(price_logs)} price_logs with {total_offers} total offers."
            )
            # Explicitly requested INSERT for price_logs
            await self._resilient_insert("price_logs", price_logs)
            
        if sentiment_history:
            await self._resilient_insert("sentiment_history", sentiment_history)
            
        if raw_archives:
            # Note: raw_archives now includes status: completed for atomicity
            # We use upsert here as we are updating existing task records
            self.admin_insforge.table("scan_tasks").upsert(raw_archives).execute()

        # 6. Room Type Catalog Update
        catalog_items = []
        for identity, group in identity_groups.items():
            # Priority: catalog (rich objects) > types (strings)
            rt = group["res"].get("room_catalog") or group["res"].get("room_types")
            if rt:
                # We need a representative hotel_id from the group
                catalog_items.append({"hotel_id": list(group["hotel_ids"])[0], "room_types": rt})
        
        if catalog_items:
            await self.batch_update_room_type_catalog(catalog_items, list(hotel_ref_map.values()))

        # 7. Batch increment successes via RPC
        batch_ids = [item.get("batch_id") for item in batch_items if item.get("batch_id")]
        if batch_ids:
            from collections import Counter
            counts = Counter(batch_ids)
            for bid, count in counts.items():
                try:
                    self.admin_insforge.rpc(
                        "increment_batch_success", {"b_id": str(bid), "p_count": count}
                    ).execute()
                except Exception as e:
                    logger.warning(f"Failed to increment batch success for {bid}: {e}")

        return {
            "synced_hotel_ids": list(hotel_ref_map.keys()),
            "notification_events": notification_events,
            "analysis_payload": analysis_payload
        }

