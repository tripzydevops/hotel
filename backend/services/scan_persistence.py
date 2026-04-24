import asyncio
import re
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

        # Helper for resilient insertion
        async def _resilient_insert(table_name: str, items: List[Dict[str, Any]]):
            if not items:
                return
            try:
                # Use admin_db for persistence in background to avoid RLS/Session issues
                # Note: price_logs has a unique index (hotel_id, check_in_date, recorded_at_minute)
                # but standard .upsert() column matching is tricky with date_trunc in index.
                # We fallback to per-item insertion if batch fails.
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

        # Execute insertions
        await _resilient_insert("price_logs", price_logs_to_insert)
        await _resilient_insert("sentiment_history", sentiment_history_to_insert)
        await _resilient_insert("alerts", alerts_to_insert)
        await _resilient_insert("query_logs", query_logs_to_insert)

        # EXPLANATION: Granular Review Persistence (Kaizen 2026)
        # While the 'hotels' table stores a JSON snapshot of reviews for fast UI display,
        # we also persist individual review objects to the 'hotel_reviews' table.
        # This enables long-term historical sentiment analysis and NLP tasks.
        await _resilient_insert("hotel_reviews", reviews_to_insert)

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
                hotel_context = res.data or {}
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

            rooms = result.get("room_types") or []
            if not rooms and "price_data" in result:
                rooms = result.get("price_data", {}).get("room_types") or []

            if isinstance(rooms, list) and rooms:
                hotel_ctx = hotel_map.get(str(hotel_id))
                for r in rooms:
                    room_dict = {"name": r} if isinstance(r, str) else r
                    if not room_dict.get("name"):
                        continue

                    text = format_room_type_for_embedding(
                        room_dict, hotel_context=hotel_ctx
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

        # 3. Resilient Bulk Persistence
        if valid_upserts:
            try:
                # Use standard pagination if batch is huge?
                # For now .upsert() handles large lists well.
                self.admin_insforge.table("room_type_catalog").upsert(
                    valid_upserts, on_conflict="id"
                ).execute()
                logger.info(
                    f"[Catalog] Vectorized sync complete for {len(valid_upserts)} rooms."
                )
            except Exception as e:
                logger.error(f"Batch catalog upsert failed: {e}")

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
        currency = result.get("currency", "USD")

        # 1. Persist to price_logs
        log_entry = {
            "hotel_id": hotel_id,
            "price": price,
            "currency": currency,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "check_in_date": str(date.today()),  # Default
            "vendor": result.get("vendor", source),
            "room_types": result.get("room_types", []),
            "parity_offers": result.get("parity_offers", []),
            "market_offers": result.get("all_prices", []),
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
                existing_sentiment = (existing_res.data or {}).get(
                    "sentiment_breakdown"
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
                "review_count": result.get("reviews_count") or result.get("reviews"),
                "stars": result.get("stars"),
                "description": result.get("description"),
                "amenities": result.get("amenities"),
                "image_url": result.get("image_url"),
                "images": result.get("images"),
                "rating_distribution": result.get("rating_distribution"),
                "check_in_time": result.get("check_in_time"),
                "check_out_time": result.get("check_out_time"),
                "sentiment_breakdown": merged_sentiment,
                "room_types": result.get("room_types"),
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
                    "review_count": result.get("reviews_count")
                    or result.get("reviews"),
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

            return {"status": "success", "price": price}
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
                    "hotel_id, price, currency, recorded_at, check_in_date, vendor, parity_offers, room_types, metadata"
                )
                .in_("hotel_id", hotel_ids)
                .gte("recorded_at", five_days_ago.isoformat())
                .order("recorded_at", desc=True)
                .execute()
            )

            for item in res.data or []:
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
                .select("id, name, min_price_floor")
                .in_("id", hotel_ids)
                .execute()
            )

            for hotel in res.data or []:
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

        raw_price = price_data.get("price")
        current_price = float(raw_price) if raw_price is not None else 0.0
        currency = str(price_data.get("currency", "TRY"))
        hotel_name = metadata.get("name", "")

        # 1. Price Validation (Kaizen 2026: Tiered Sanity Check)
        is_valid = True

        # A. Minimum Floor Safeguard (User Insight 2026)
        if currency == "TRY" and current_price > 0:
            # 1. Check manual floor from DB
            floor = float(metadata.get("min_price_floor") or 0)

            # 2. Heuristic for Brands (e.g. Ramada > 3000)
            if floor == 0:
                brand_floors = {
                    "ramada": 3000.0,
                    "hilton": 3000.0,
                    "sheraton": 3000.0,
                    "marriott": 3000.0,
                    "wyndham": 3000.0,
                    "holiday inn": 3000.0,
                }
                lower_name = hotel_name.lower()
                for brand, brand_floor in brand_floors.items():
                    if brand in lower_name:
                        floor = brand_floor
                        break

            # 3. Global absolute minimum
            if floor == 0:
                floor = 200.0

            if current_price < floor:
                if log_reasoning_fn:
                    await log_reasoning_fn(
                        session_id,
                        "Safeguard",
                        f"Rejected unrealistic price {current_price} TRY for '{hotel_name}'. Floor is {floor} TRY.",
                        "warning",
                    )
                current_price = 0.0
                is_valid = False

        # B. 30% Variance Safeguard
        if is_valid and current_price > 0:
            avg_baseline = 0.0
            recent_valid = [
                float(h["price"])
                for h in history
                if h.get("price") is not None and float(h["price"]) > 0
            ]
            if recent_valid:
                avg_baseline = sum(recent_valid) / len(recent_valid)
                # REJECT if price deviates by more than 30% from verified baseline
                lower_bound = avg_baseline * 0.7
                upper_bound = avg_baseline * 1.3

                if current_price < lower_bound or current_price > upper_bound:
                    if log_reasoning_fn:
                        await log_reasoning_fn(
                            session_id,
                            "Safeguard",
                            f"Rejected suspicious price {current_price} (Avg: {avg_baseline:.2f}). Deviation > 30%.",
                            "warning",
                        )
                    current_price = 0.0
                    is_valid = False

        # Normalization
        target_currency = getattr(options, "currency", "TRY") if options else "TRY"
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
            # Level 1: Same check-in date
            fallback = next(
                (h for h in history if str(h.get("check_in_date")) == check_in_str),
                None,
            )
            if not fallback:
                # Level 2: Most recent check-in
                fallback = history[0] if history else None

            if fallback:
                current_price = float(fallback["price"])
                currency = str(fallback["currency"])
                is_estimated = True
                if log_reasoning_fn:
                    await log_reasoning_fn(
                        session_id,
                        "Analysis",
                        f"[FALLBACK] Using history: {current_price} {currency}",
                        "warning",
                    )

        # 3. Market Depth & Room Persistence
        offers = price_data.get("offers", [])
        is_shallow = len(offers) < 5 and not is_estimated
        current_room_types = price_data.get("room_types", [])
        if not current_room_types and not is_estimated and status == "success":
            # Carry forward room types if missing but scan was successful
            for h in history:
                if h.get("room_types"):
                    current_room_types = h["room_types"]
                    break

        # 4. Metadata & Sentiment
        meta_update = {
            "last_scan": datetime.now(timezone.utc).isoformat(),
            "vendor_source": price_data.get("vendor", "Provider"),
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

        current_hotel = hotel_data_res.data if hotel_data_res else {}
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
                # Always snapshot room types if found, to keep the UI fresh
                should_update = True
            elif field == "currency" and new_val != existing_val:
                # Force update currency if it changed (e.g. was None or different)
                should_update = True

            if should_update:
                meta_update[field] = new_val

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
                self.insforge, hotel_id
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
            "vendor": price_data.get("vendor", "Provider"),
            "parity_offers": offers,
            "room_types": current_room_types,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "is_deep_scan": result.get("is_deep_scan", False),
            "market_offers": price_data.get("all_prices", []),
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
        if "reviews" in price_data and isinstance(price_data["reviews"], list):
            import uuid

            for r in price_data["reviews"]:
                # Map SerpApi fields to our DB schema
                review_obj = {
                    "hotel_id": hotel_id,
                    "external_id": r.get("id") or str(uuid.uuid4()),
                    "author": r.get("title") or r.get("author", "Anonymous"),
                    "rating": r.get("rating", 0),
                    "text": r.get("snippet") or r.get("review_text") or "",
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
        hotel_ref_map = {str(h["id"]): h for h in (hotels_lookup_res.data or [])}
        
        # 2. Group and Merge Results by Identity
        # Identity is property_token if exists, otherwise hotel_id
        identity_groups = {} # identity -> { merged_res, task_ids, hotel_ids }
        
        for item in batch_items:
            hid = str(item["hotel_id"])
            h_ref = hotel_ref_map.get(hid)
            if not h_ref: continue # Hotel not found in DB
            
            identity = h_ref.get("property_token") or hid
            task_id = item.get("scan_task_id")
            res = item.get("result", {})
            if not res or res.get("status") != "success": continue
            
            if identity not in identity_groups:
                identity_groups[identity] = {
                    "res": res, 
                    "task_ids": [task_id] if task_id else [],
                    "hotel_ids": {hid}
                }
            else:
                group = identity_groups[identity]
                group["hotel_ids"].add(hid)
                if task_id: group["task_ids"].append(task_id)
                
                # Smart merge: Priority on highest price and deeper metadata
                existing = group["res"]
                for key, val in res.items():
                    if key == "price":
                        new_p = float(val) if val else 0
                        old_p = float(existing.get("price") or 0)
                        if new_p > old_p: existing["price"] = new_p
                    elif val and (not existing.get(key) or (isinstance(val, (list, dict)) and len(str(val)) > len(str(existing.get(key))))):
                        existing[key] = val

        # 3. Discover All Variations for Identities
        tokens = [k for k in identity_groups.keys() if not k.isdigit()] # Heuristic: tokens are UUIDs/strings, IDs are numeric strings
        # Actually, tokens and IDs can both be strings. Let's just use tokens we found.
        found_tokens = list(set(h["property_token"] for h in hotel_ref_map.values() if h.get("property_token")))
        
        variations_map = {} # identity -> [hotel_records]
        if found_tokens:
            v_res = (
                self.admin_insforge.table("hotels")
                .select("id, property_token, name, location")
                .in_("property_token", found_tokens)
                .execute()
            )
            for v in (v_res.data or []):
                tok = v["property_token"]
                if tok not in variations_map: variations_map[tok] = []
                variations_map[tok].append(v)
        
        # 4. Prepare Vectorized Payloads
        hotel_updates = []
        price_logs = []
        sentiment_history = []
        raw_archives = []
        analysis_payload = []
        notification_events = []
        completed_task_ids = []
        
        for identity, group in identity_groups.items():
            res_data = group["res"]
            price = float(res_data.get("price") or 0)
            currency = res_data.get("currency", "TRY")
            
            # Determine targets: All variations if identity is a token, else just the single hotel
            targets = variations_map.get(identity)
            if not targets:
                # Fallback: if identity is an ID, find it in hotel_ref_map
                targets = [hotel_ref_map.get(identity)] if hotel_ref_map.get(identity) else []
            
            if not targets: continue
            
            # Prepare Analysis Payload (once per identity)
            analysis_item = res_data.copy()
            analysis_item.update({"identity": identity, "targets_count": len(targets)})
            analysis_payload.append(analysis_item)
            
            for target in targets:
                tid = str(target["id"])
                
                # Hotel Update Payload
                upd = {
                    "id": tid,
                    "last_scanned_at": now_ts,
                    "current_price": price if price > 0 else None
                }
                
                # Map rich metadata
                metadata_fields = [
                    "rating", "stars", "description", "amenities", "check_in_time", 
                    "check_out_time", "sentiment_breakdown", "latitude", "longitude",
                    "phone", "website", "address", "image_url", "rating_distribution",
                    "guest_mentions", "images"
                ]
                for field in metadata_fields:
                    if res_data.get(field): upd[field] = res_data[field]
                
                # Reviews & OTA Summary
                if res_data.get("reviews") or res_data.get("reviews_count"):
                    upd["review_count"] = res_data.get("reviews") or res_data.get("reviews_count")
                
                ota_prices = res_data.get("ota_prices") or []
                if ota_prices:
                    upd["reviews"] = {
                        "ota_count": len(ota_prices),
                        "ota_min_price": min((p.get("price") or 999999) for p in ota_prices),
                        "ota_sources": list(set(p.get("source") for p in ota_prices if p.get("source")))
                    }
                
                # Room Types
                room_types = res_data.get("room_catalog") or res_data.get("room_types")
                if room_types: upd["room_types"] = room_types
                
                hotel_updates.append(upd)
                
                # Price Log (Insert)
                if price > 0:
                    price_logs.append({
                        "hotel_id": tid,
                        "price": price,
                        "currency": currency,
                        "parity_offers": ota_prices or res_data.get("parity_offers", []),
                        "market_offers": res_data.get("all_prices") or res_data.get("market_offers", []),
                        "room_types": room_types,
                        "recorded_at": now_ts,
                        "source": source
                    })
                
                # Sentiment History
                if res_data.get("sentiment_breakdown"):
                    sentiment_history.append({
                        "hotel_id": tid,
                        "rating": res_data.get("rating"),
                        "review_count": res_data.get("reviews") or res_data.get("reviews_count"),
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
                    "parity_offers": ota_prices or res_data.get("parity_offers", [])
                })
            
            # Archive raw results
            for tid in group["task_ids"]:
                completed_task_ids.append(tid)
                if res_data.get("raw_data"):
                    raw_archives.append({"id": tid, "raw_results": res_data["raw_data"]})

        # 5. Execute Batch Operations
        if hotel_updates:
            self.admin_insforge.table("hotels").upsert(hotel_updates).execute()
        
        if price_logs:
            # Explicitly requested INSERT for price_logs
            self.admin_insforge.table("price_logs").insert(price_logs).execute()
            
        if sentiment_history:
            self.admin_insforge.table("sentiment_history").insert(sentiment_history).execute()
            
        if completed_task_ids:
            self.admin_insforge.table("scan_tasks").update({"status": "completed"}).in_("id", completed_task_ids).execute()
            
        if raw_archives:
            self.admin_insforge.table("scan_tasks").upsert(raw_archives).execute()

        # 6. Room Type Catalog Update
        catalog_items = []
        for identity, group in identity_groups.items():
            rt = group["res"].get("room_types") or group["res"].get("room_catalog")
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

