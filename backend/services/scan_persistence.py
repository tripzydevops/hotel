import logging
import asyncio
from datetime import datetime, timedelta, timezone, date
from typing import List, Dict, Any, Optional, cast
from uuid import UUID
from supabase import Client

from backend.models.schemas import ScanOptions
from backend.utils.helpers import convert_currency, log_query
from backend.utils.sentiment_utils import merge_sentiment_breakdowns, generate_mentions
from backend.services.price_comparator import price_comparator
from backend.services.predictive_service import predictive_service
from backend.utils.embeddings import get_embedding
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class ScanPersistenceService:
    """
    Unified Tier-1 Service for persisting scan results.
    Handles price validation, smart continuity, sentiment merging, 
    threshold enforcement, and batch updates.
    """

    def __init__(self, db: Client):
        self.db = db

    async def persist_scan_results(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        settings: Optional[Dict[str, Any]] = None,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None,
        log_reasoning_fn = None  # Optional callback for logging reasoning
    ) -> Dict[str, Any]:
        """
        Executes the persistence pipeline for a batch of scraper results.
        """
        analysis_summary = {
            "prices_updated": 0,
            "alerts": [],
            "target_price": None,
        }

        hotel_ids = [str(res.get("hotel_id")) for res in scraper_results if res.get("hotel_id")]
        if not hotel_ids:
            return analysis_summary

        # 1. Batch History Lookup
        history_map = await self._fetch_history_map(hotel_ids)
        if log_reasoning_fn:
            await log_reasoning_fn(session_id, "Memory", f"Batch history lookup complete for {len(hotel_ids)} properties.", "info")

        # Batch collectors
        price_logs_to_insert = []
        sentiment_history_to_insert = []
        alerts_to_insert = []
        query_logs_to_insert = []
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
                threshold=threshold,
                options=options,
                session_id=session_id,
                log_reasoning_fn=log_reasoning_fn
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

            # 1.5 Prepare Query Log entry for audit
            query_logs_to_insert.append(processed["query_log"])

        # 2. Final Batch Insertions
        try:
            if price_logs_to_insert:
                self.db.table("price_logs").insert(price_logs_to_insert).execute()
            if sentiment_history_to_insert:
                self.db.table("sentiment_history").insert(sentiment_history_to_insert).execute()
            if alerts_to_insert:
                self.db.table("alerts").insert(alerts_to_insert).execute()
            if query_logs_to_insert:
                self.db.table("query_logs").insert(query_logs_to_insert).execute()
        except Exception as e:
            logger.error(f"Batch persistence failed: {e}")
            if log_reasoning_fn:
                await log_reasoning_fn(session_id, "Analysis", f"[CRITICAL] Batch insert failed: {str(e)}", "error")

        # 3. Parallel Embedding Generation
        if embedding_queue:
            await self._process_embeddings(embedding_queue, session_id, log_reasoning_fn)

        analysis_summary["volatility_avg"] = sum(volatilities) / len(volatilities) if volatilities else 0.0
        return analysis_summary

    async def _fetch_history_map(self, hotel_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        history_map = {}
        try:
            res = (
                self.db.table("price_logs")
                .select("hotel_id, price, currency, recorded_at, check_in_date, vendor, parity_offers, room_types, metadata")
                .in_("hotel_id", hotel_ids)
                .order("recorded_at", desc=True)
                .limit(len(hotel_ids) * 5)
                .execute()
            )
            for entry in (res.data or []):
                hid = entry.get("hotel_id")
                if hid not in history_map:
                    history_map[hid] = []
                if len(history_map[hid]) < 5:
                    history_map[hid].append(entry)
        except Exception as e:
            logger.warning(f"History fetch failed: {e}")
        return history_map

    async def _process_hotel_entry(
        self,
        user_id: UUID,
        result: Dict[str, Any],
        history: List[Dict[str, Any]],
        threshold: float,
        options: Optional[ScanOptions],
        session_id: Optional[UUID],
        log_reasoning_fn
    ) -> Dict[str, Any]:
        hotel_id = result.get("hotel_id")
        price_data = cast(Dict[str, Any], result.get("price_data") or {})
        status = result.get("status")
        
        raw_price = price_data.get("price")
        current_price = float(raw_price) if raw_price is not None else 0.0
        currency = str(price_data.get("currency", "TRY"))
        
        # 1. Price Validation
        is_valid = True
        avg_baseline = 0.0
        recent_valid = [float(h["price"]) for h in history if h.get("price") is not None and float(h["price"]) > 0]
        if recent_valid and current_price > 0:
            avg_baseline = sum(recent_valid) / len(recent_valid)
            if current_price < (avg_baseline * 0.5):
                if log_reasoning_fn:
                    await log_reasoning_fn(session_id, "Safeguard", f"Rejected suspicious price {current_price} (Avg: {avg_baseline:.2f}).", "warning")
                current_price = 0.0
                is_valid = False

        # Normalization
        target_currency = getattr(options, "currency", "TRY") if options else "TRY"
        if current_price > 0 and currency != target_currency:
            current_price = convert_currency(current_price, currency, target_currency)
            currency = target_currency

        # 2. Smart Continuity
        is_estimated = False
        check_in = result.get("check_in") or (date.today() if options is None else getattr(options, "check_in", date.today()))
        check_in_str = str(check_in)

        if current_price <= 0:
            # Level 1: Same check-in date
            fallback = next((h for h in history if str(h.get("check_in_date")) == check_in_str), None)
            if not fallback:
                # Level 2: Most recent check-in
                fallback = history[0] if history else None
            
            if fallback:
                current_price = float(fallback["price"])
                currency = str(fallback["currency"])
                is_estimated = True
                if log_reasoning_fn:
                    await log_reasoning_fn(session_id, "Analysis", f"[FALLBACK] Using history: {current_price} {currency}", "warning")

        # 3. Market Depth & Room Persistence
        offers = price_data.get("offers", [])
        is_shallow = len(offers) < 5 and not is_estimated
        current_room_types = price_data.get("room_types", [])
        if not current_room_types and not is_estimated:
            # Carry forward room types if missing
            for h in history:
                if h.get("room_types"):
                    current_room_types = h["room_types"]
                    break

        # 4. Metadata & Sentiment
        meta_update = {
            "last_scan": datetime.now(timezone.utc).isoformat(),
            "vendor_source": price_data.get("vendor", "Provider"),
            "preferred_currency": currency,
        }
        
        # Only update the 'live' price if we have a fresh, valid one
        if current_price > 0 and not is_estimated:
            meta_update["current_price"] = current_price
        
        # KAİZEN: Smart Update Logic for Static Fields
        # We fetch existing state to avoid redundant writes for stable data (descriptions, amenities, etc.)
        hotel_data_res = self.db.table("hotels").select(
            "sentiment_breakdown, description, amenities, images, phone, website, address, stars, latitude, longitude, room_types, updated_at"
        ).eq("id", hotel_id).maybe_single().execute()
        
        current_hotel = hotel_data_res.data if hotel_data_res else {}
        existing_breakdown = (current_hotel.get("sentiment_breakdown") if current_hotel else []) or []
        
        is_sentiment_modified = False
        if "reviews_breakdown" in price_data:
            merged = merge_sentiment_breakdowns(existing_breakdown, price_data["reviews_breakdown"])
            meta_update["sentiment_breakdown"] = merged
            meta_update["guest_mentions"] = generate_mentions(merged)
            is_sentiment_modified = True

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
                is_stale = True # Fallback to update if parsing fails
        
        static_fields = ["description", "amenities", "images", "phone", "website", "address", "stars", "latitude", "longitude", "room_types"]
        for field in static_fields:
            new_val = price_data.get(field)
            if not new_val:
                continue
                
            existing_val = current_hotel.get(field)
            should_update = False
            
            if not existing_val or is_stale:
                should_update = True
            elif field == "description" and len(str(new_val)) > len(str(existing_val or "")) * 1.2:
                # Significant description improvement (>20% longer)
                should_update = True
            elif field == "amenities" and isinstance(new_val, list) and len(new_val) > len(existing_val or []):
                # More amenities found
                should_update = True
            elif field == "room_types" and isinstance(new_val, list) and len(new_val) > 0:
                # Always snapshot room types if found, to keep the UI fresh
                should_update = True
            
            if should_update:
                meta_update[field] = new_val

        # Update DB
        if meta_update:
            self.db.table("hotels").update(meta_update).eq("id", hotel_id).execute()

        # 5. Alert & Volatility
        alert = None
        volatility = 0.0
        if current_price > 0:
            volatility = await predictive_service.calculate_market_volatility(self.db, hotel_id)
            active_threshold = predictive_service.get_smart_threshold(threshold, volatility)
            
            last_price = float(history[0]["price"]) if history else 0.0
            if last_price > 0:
                breach = price_comparator.check_threshold_breach(current_price, last_price, active_threshold)
                if breach:
                    alert = {"user_id": str(user_id), "hotel_id": hotel_id, **breach}

        # 6. Prepare Outputs
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
            "metadata": {"is_shallow": is_shallow, "extraction_depth": len(offers)}
        }

        sentiment_history = None
        if is_sentiment_modified:
            sentiment_history = {
                "hotel_id": hotel_id,
                "rating": meta_update.get("rating"),
                "review_count": meta_update.get("review_count"),
                "sentiment_breakdown": meta_update.get("sentiment_breakdown"),
            }

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
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            "sentiment_history": sentiment_history,
            "alert": alert,
            "volatility": volatility,
            "embedding_task": (hotel_id, meta_update) if is_sentiment_modified else None
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
            self.db.table("hotels").update({"embedding_status": status}).eq("id", hid).execute()
        
        if log_reasoning_fn:
            await log_reasoning_fn(session_id, "Analysis", f"[Embedding] Parallel processing complete for {len(tasks)} profiles.", "info")

    async def _update_sentiment_embedding(self, hotel_id: str, meta: Dict[str, Any]) -> bool:
        # Simplified version of the analyst logic
        try:
            name = meta.get("name", "Hotel")
            parts = [f"Hotel: {name}"]
            if meta.get("sentiment_breakdown"):
                parts.append(f"Sentiment: {str(meta['sentiment_breakdown'])[:500]}")
            
            profile = "\n".join(parts)
            embedding = await get_embedding(profile)
            if embedding:
                self.db.table("hotels").update({"sentiment_embedding": embedding}).eq("id", hotel_id).execute()
                return True
        except Exception: pass
        return False
