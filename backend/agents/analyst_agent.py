from backend.agents.market_intelligence_agent import MarketIntelligenceAgent
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, cast
from uuid import UUID
from supabase import Client
from backend.models.schemas import ScanOptions
from backend.services.price_comparator import price_comparator
from backend.utils.embeddings import get_embedding, format_hotel_for_embedding
from backend.agents.notifier_agent import NotifierAgent
from backend.utils.helpers import convert_currency, log_query, convert_currency as _cc
from backend.utils.sentiment_utils import generate_mentions, merge_sentiment_breakdowns
from backend.services.predictive_service import predictive_service


class AnalystAgent:
    """
    Agent responsible for market analysis, price comparison, and reasoning.
    2026 Strategy: Uses high-reasoning models (Deep Think) to explain market shifts.
    """

    def __init__(self, db: Client):
        self.adk_agent = MarketIntelligenceAgent()
        self.db = db
        self._log_buffer = {}
        self._embedding_queue = []

    async def log_reasoning(
        self,
        session_id: Optional[UUID],
        step: str,
        message: str,
        level: str = "info",
        metadata: Optional[Dict] = None,
    ):
        """Buffer a log entry in memory for batch processing later."""
        if not session_id:
            return

        sid_key = str(session_id)
        if sid_key not in self._log_buffer:
            self._log_buffer[sid_key] = []

        import time
        entry = {
            "step": step,
            "level": level,
            "message": message,
            "timestamp": time.time(),
            "metadata": metadata or {},
        }
        self._log_buffer[sid_key].append(entry)

    async def _flush_logs(self, session_id: Optional[UUID]):
        """Batch update the reasoning trace to the database in a single round-trip."""
        if not session_id:
            return

        sid_key = str(session_id)
        if sid_key not in self._log_buffer or not self._log_buffer[sid_key]:
            return

        try:
            # Single atomic append
            res = (
                self.db.table("scan_sessions")
                .select("reasoning_trace")
                .eq("id", sid_key)
                .execute()
            )
            
            raw_trace = []
            if res.data:
                db_trace = res.data[0].get("reasoning_trace")
                if isinstance(db_trace, list):
                    raw_trace = db_trace
            
            raw_trace.extend(self._log_buffer[sid_key])

            self.db.table("scan_sessions").update(
                {
                    "reasoning_trace": raw_trace,
                    "updated_at": datetime.now().isoformat(),
                }
            ).eq("id", sid_key).execute()

            # Clear buffer for this session
            self._log_buffer[sid_key] = []
        except Exception as e:
            print(f"[AnalystAgent] Log flush failed: {e}")

    async def analyze_results(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        settings: Optional[Dict[str, Any]] = None,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        The Core Analysis Pipeline.

        This method transforms raw scraper output into actionable market intelligence.

        Key Stages:
        1. Price Validation & Normalization: Filters glitches and converts currencies.
        2. Smart Continuity (Persistence): Fills gaps using historical rates (up to 7 days).
        3. Sentiment Memory (Kaizen): Merges existing category scores with new findings
           to prevent data loss and maintain long-term sentiment profiles.
        4. Global Pulse: Groups price changes across the network to notify other users
           who track the same hotels, reducing redundant scans.
        5. Embedding Synchrony: Regenerates vector profiles for 'stale' sentiment data.
        """
        print(f"[DEBUG] AnalystAgent.analyze_results started for User {user_id}")
        analysis_summary: Dict[str, Any] = {
            "prices_updated": 0,
            "alerts": [],
            "target_price": None,
        }

        reasoning_log = []
        hotel_ids = [str(res.get("hotel_id")) for res in scraper_results if res.get("hotel_id")]

        if not hotel_ids:
            return analysis_summary

        # 1. Pre-fetch Historical Prices for all hotels in batch
        # We fetch the last 2 logs for each hotel to compare with current
        history_map: Dict[str, List[Dict[str, Any]]] = {}
        try:
            # Note: Complex limit-per-group is hard in Supabase/PostgREST without RPC
            # For simplicity, we fetch recent logs for these hotels
            hist_res = (
                self.db.table("price_logs")
                .select("hotel_id, price, currency, recorded_at")
                .in_("hotel_id", hotel_ids)
                .order("recorded_at", desc=True)
                .limit(len(hotel_ids) * 2)
                .execute()
            )

            for entry in (hist_res.data or []):
                if not isinstance(entry, dict):
                    continue
                hid = entry.get("hotel_id")
                if not hid:
                    continue
                if hid not in history_map:
                    history_map[hid] = []
                # Explicitly cast to help linter with List type
                h_list = cast(List, history_map[hid])
                if len(h_list) < 2:
                    h_list.append(entry)
            
            await self.log_reasoning(session_id, "Memory", f"Batch history lookup complete for {len(hotel_ids)} properties.", "info")
        except Exception as e:
            print(f"[AnalystAgent] History pre-fetch warning: {e}")

        # Batch collectors
        price_logs_to_insert = []
        sentiment_history_to_insert = []
        alerts_to_insert = []
        pulse_queue = []  # Collectors for Global Pulse batching
        volatilities = [] # Collectors for Market Average Volatility

        # 2. Main Analysis Loop
        for res in scraper_results:
            # KAİZEN: Explicitly associate value to prevent UnboundLocalError
            is_sentiment_modified = False
            try:
                hotel_id = res.get("hotel_id")
                # Force type to Dict[str, Any] to help linter
                pd_raw = res.get("price_data")
                price_data: Dict[str, Any] = cast(Dict[str, Any], pd_raw) if isinstance(pd_raw, dict) else {}
                status = res.get("status")

                if not hotel_id:
                    continue

                if status == "success" and isinstance(price_data, dict):
                    current_price = price_data.get("price", 0.0)
                    currency = price_data.get("currency", "TRY")
                else:
                    error_detail = "Unknown Error"
                    if isinstance(price_data, dict) and price_data.get("error"):
                        error_detail = price_data.get("error")
                    elif status:
                        error_detail = status

                    await self.log_reasoning(session_id, "Analysis", 
                        f"[Skip] Hotel {hotel_id} - status: {error_detail}"
                    )
                    # KAİZEN: Allow non-success hotels to continue to trigger Smart Continuity (historical fallback)
                    current_price = 0.0
                    currency = "TRY"
                    if price_data is None: price_data = {}

                # EXPLANATION: Price Sanity Safeguard
                is_valid_drop = True
                avg_price = 0.0

                if price_data:
                    current_price = price_data.get("price", 0.0)
                    currency = price_data.get("currency", "TRY")
                else:
                    current_price = 0.0
                    currency = "TRY"

                if not current_price or current_price <= 0:
                    await self.log_reasoning(
                        session_id,
                        "Analysis",
                        f"Analyzing {hotel_id}. No Price Found.",
                        "info"
                    )
                else:
                    is_valid_drop, avg_price = self._validate_price_drop(
                        hotel_id, current_price, currency
                    )
                    
                    if not is_valid_drop:
                        await self.log_reasoning(
                            session_id,
                            "Safeguard",
                            f"Rejected suspicious price {current_price} {currency} (Avg: {avg_price:.2f}). Triggering fallback.",
                            "warning"
                        )
                        current_price = 0.0
                    else:
                        await self.log_reasoning(
                            session_id,
                            "Analysis",
                            f"Analyzing {hotel_id}. Raw Price: {current_price} {currency}",
                            "info"
                        )
        
                        # Currency Normalization
                        target_currency = "TRY"
                        if options is not None:
                            # Using getattr to bypass Unknown type issues if import failed
                            opt_curr = getattr(options, "currency", "TRY")
                            if opt_curr:
                                target_currency = str(opt_curr)
                            
                        if currency == "USD" and target_currency == "TRY" and current_price > 0:
                            old_price = current_price
                            current_price = convert_currency(current_price, "USD", "TRY")
                            currency = "TRY"
                            await self.log_reasoning(session_id, "Analysis", 
                                f"[Normalization] Converted {old_price} USD -> {current_price} TRY"
                            )
        
                check_in = res.get("check_in")
                if not check_in:
                    check_in = datetime.now().date()
                check_in_str = (
                    check_in.isoformat()
                    if hasattr(check_in, "isoformat")
                    else str(check_in)
                )

                # EXPLANATION: Smart Continuity (Vertical Fill Persistence)
                # User Requirement: "if the scan fails or has no price then look back at the last successful price... up to 7 days back"
                is_estimated = False

                if not current_price or current_price <= 0:
                    await self.log_reasoning(session_id, "Analysis", 
                        f"[Continuity] Price missing for {hotel_id} on {check_in_str}. Checking history..."
                    )
                    try:
                        # Look for the most recent price for THIS specific check-in date
                        cutoff = (datetime.now() - timedelta(days=7)).isoformat()
                        history_res = (
                            self.db.table("price_logs")
                            .select("price, currency, recorded_at, vendor, parity_offers, room_types")
                            .eq("hotel_id", hotel_id)
                            .eq("check_in_date", check_in_str)
                            .gt("recorded_at", cutoff)
                            .order("recorded_at", desc=True)
                            .limit(1)
                            .execute()
                        )

                        if history_res.data:
                            last_valid = history_res.data[0]
                            current_price = float(last_valid.get("price") or 0.0)
                            currency = str(last_valid.get("currency") or "TRY")
                            # Type narrowing for assignment
                            pd_dict = cast(Dict[str, Any], price_data)
                            pd_dict["vendor"] = str(last_valid.get("vendor") or pd_dict.get("vendor", "Unknown"))
                            pd_dict["offers"] = list(cast(list, last_valid.get("parity_offers") or []))
                            pd_dict["room_types"] = list(cast(list, last_valid.get("room_types") or []))
                            is_estimated = True
                            await self.log_reasoning(session_id, "Analysis", 
                                f"[Continuity] Found historical price for SAME date: {current_price} {currency}"
                            )
                        else:
                            # Level 2 Fallback
                            history_any_res = (
                                self.db.table("price_logs")
                                .select("price, currency, recorded_at, check_in_date, vendor, parity_offers, room_types")
                                .eq("hotel_id", hotel_id)
                                .gt("recorded_at", cutoff)
                                .order("recorded_at", desc=True)
                                .limit(1)
                                .execute()
                            )
                            if history_any_res.data:
                                last_any = history_any_res.data[0]
                                current_price = float(last_any.get("price") or 0.0)
                                currency = str(last_any.get("currency") or "TRY")
                                # Type narrowing for assignment
                                pd_dict = cast(Dict[str, Any], price_data)
                                pd_dict["vendor"] = str(last_any.get("vendor") or pd_dict.get("vendor", "Unknown"))
                                pd_dict["offers"] = list(cast(list, last_any.get("parity_offers") or []))
                                pd_dict["room_types"] = list(cast(list, last_any.get("room_types") or []))
                                is_estimated = True
                                await self.log_reasoning(session_id, "Analysis", 
                                    f"[Continuity] Found recent price for different date ({last_any.get('check_in_date')}): {current_price} {currency}"
                                )
                            else:
                                current_price = 0.0
                                await self.log_reasoning(session_id, "Analysis", "[Continuity] No history found.")
                    except Exception as e:
                        print(f"[AnalystAgent] Continuity failed: {e}")

                # Market Depth Safeguard
                offers = price_data.get("offers", []) if price_data else []
                is_shallow = False
                if len(offers) < 5 and not is_estimated:
                    is_shallow = True
                    try:
                        prev_res = self.db.table("price_logs").select("metadata").eq("hotel_id", hotel_id).order("recorded_at", desc=True).limit(2).execute()
                        prev_shallow_count = sum(1 for row in prev_res.data if row.get("metadata", {}).get("is_shallow"))
                        if prev_shallow_count >= 2:
                            await self.log_reasoning(session_id, "Safeguard", f"[CRITICAL DEGRADATION] PERSISTENT shallow extraction for {hotel_id}. Only {len(offers)} offers available.", "error")
                        else:
                            await self.log_reasoning(session_id, "Safeguard", f"Low market depth for {hotel_id} ({len(offers)} offers). Metadata flagged.", "warning")
                    except Exception:
                        pass

                # Room Type Persistence
                current_room_types = price_data.get("room_types", []) if price_data else []
                if not current_room_types and not is_estimated:
                    try:
                        rt_cutoff = (datetime.now() - timedelta(days=7)).isoformat()
                        rt_history = self.db.table("price_logs").select("room_types").eq("hotel_id", hotel_id).gt("recorded_at", rt_cutoff).order("recorded_at", desc=True).limit(5).execute()
                        for prev_log in rt_history.data or []:
                            if prev_log.get("room_types"):
                                prev_raw = cast(Dict, prev_log).get("room_types")
                                current_room_types = list(cast(list, prev_raw)) if isinstance(prev_raw, (list, tuple)) else []
                                await self.log_reasoning(session_id, "Analysis", f"[Room Persistence] Carried forward {len(current_room_types)} types.")
                                break
                    except Exception: pass

                # EXPLANATION: Session-Aware Persistence
                # Previously, we would skip logging if the result was a 'global_cache' hit
                # and a recent log existed. This caused "Ghost Updates" where your hotel card
                # looked fresh but had no history. 
                # FIX: If we have an active session_id, we ALWAYS log the result to ensure
                # the user can see their scan in history.
                should_log = True
                if not session_id:
                    # If background monitoring without a session, we still avoid duplicates
                    has_recent_log = False
                    if hotel_id in history_map and history_map[hotel_id]:
                        latest_log_time = history_map[hotel_id][0].get("recorded_at")
                        if latest_log_time:
                            try:
                                log_dt = datetime.fromisoformat(latest_log_time.replace("Z", "+00:00"))
                                if (datetime.now(timezone.utc) - log_dt).total_seconds() < 10800:
                                    has_recent_log = True
                            except Exception: pass
                    
                    if price_data and price_data.get("source") == "global_cache" and has_recent_log:
                        should_log = False

                if should_log:
                    price_logs_to_insert.append({
                        "hotel_id": hotel_id,
                        "price": current_price if current_price else 0.0,
                        "currency": currency,
                        "check_in_date": check_in_str,
                        "source": price_data.get("source", "serpapi") if price_data else "serpapi",
                        "vendor": price_data.get("vendor", "Unknown") if price_data else "Unknown",
                        "parity_offers": offers,
                        "room_types": current_room_types,
                        "is_estimated": is_estimated,
                        "session_id": str(session_id) if session_id else None,
                        "serp_api_id": (price_data.get("property_token") or price_data.get("serp_api_id")) if price_data else None,
                        "metadata": {"is_shallow": is_shallow, "extraction_depth": len(offers)},
                    })
                
                if session_id:
                    await log_query(db=self.db, user_id=user_id, hotel_name=res.get("hotel_name", "Hotel"), location=res.get("location"), action_type="monitor", status="success" if current_price > 0 else "error", price=current_price, currency=currency, vendor=(price_data.get("vendor") if price_data else "Unknown") if not is_estimated else (f"Estimated ({price_data.get('vendor', 'History')})" if price_data else "Estimated"), session_id=session_id)

                analysis_summary["prices_updated"] += 1

                # [Global Pulse] Phase 2
                if current_price and current_price > 0 and price_data:
                    serp_api_id = price_data.get("property_token") or price_data.get("serp_api_id")
                    if serp_api_id:
                        pulse_queue.append({"serp_api_id": serp_api_id, "hotel_id": hotel_id, "hotel_name": res.get("hotel_name", "Hotel"), "current_price": current_price, "currency": currency})

                # Metadata Update
                existing_hotel = self.db.table("hotels").select("sentiment_breakdown").eq("id", hotel_id).maybe_single().execute()
                current_breakdown = (existing_hotel.data.get("sentiment_breakdown") if existing_hotel.data else []) or []
                meta_update = {"last_scan": datetime.now().isoformat(), "vendor_source": (price_data.get("vendor", "SerpApi") if price_data else "SerpApi"), "embedding_status": "current"}
                if current_price and current_price > 0:
                    meta_update["current_price"] = current_price

                if price_data and "reviews_breakdown" in price_data:
                    merged_breakdown = merge_sentiment_breakdowns(current_breakdown, price_data["reviews_breakdown"])
                    meta_update["sentiment_breakdown"] = merged_breakdown
                    is_sentiment_modified = True

                for field in ["rating", "image_url", "stars", "review_count", "amenities"]:
                    val = price_data.get(field) if isinstance(price_data, dict) else None
                    if val is not None: meta_update[field] = val

                if meta_update.get("sentiment_breakdown"):
                    meta_update["guest_mentions"] = generate_mentions(meta_update["sentiment_breakdown"])
                
                if is_sentiment_modified:
                    meta_update["embedding_status"] = "stale"
                    if not hasattr(self, "_embedding_queue"):
                        self._embedding_queue = []
                    self._embedding_queue.append((hotel_id, meta_update))

                    # KAİZEN: Populate sentiment history for time-series analysis
                    sentiment_history_to_insert.append({
                        "hotel_id": hotel_id,
                        "rating": meta_update.get("rating"),
                        "review_count": meta_update.get("review_count"),
                        "sentiment_breakdown": meta_update.get("sentiment_breakdown"),
                    })

                self.db.table("hotels").update(meta_update).eq("id", hotel_id).execute()

                # Threshold breaches
                if current_price and current_price > 0:
                    hotel_history = history_map.get(hotel_id, [])
                    if hotel_history:
                        prev_entry = hotel_history[0]
                        prev_price_raw = prev_entry.get("price")
                        prev_currency = str(prev_entry.get("currency") or "USD")
                        if prev_price_raw is not None:
                            previous_price = convert_currency(float(prev_price_raw), prev_currency, currency)
                        else:
                            previous_price = 0.0
                        # Phase 2.1: Predictive Intensity Suppression
                        # Use volatility-aware thresholds to reduce noise in high-volatility markets.
                        volatility = await predictive_service.calculate_market_volatility(self.db, hotel_id)
                        volatilities.append(volatility)
                        active_threshold = predictive_service.get_smart_threshold(threshold, volatility)
                        
                        if active_threshold > threshold:
                            await self.log_reasoning(session_id, "Yield Intel", 
                                f"[SmartThreshold] Suppressing noise: {threshold}% -> {active_threshold}% (Volatility: {volatility}%)", 
                                "info"
                            )

                        alert = price_comparator.check_threshold_breach(current_price, previous_price, active_threshold)
                        if alert:
                            change_pct = abs((current_price - previous_price) / previous_price) * 100 if previous_price else 0
                            await self.log_reasoning(session_id, "Alert", f"Threshold Breach Verified: {current_price} vs {previous_price} ({change_pct:.1f}%).", "error")
                            alerts_to_insert.append({"user_id": str(user_id), "hotel_id": hotel_id, **alert})
                        else:
                            await self.log_reasoning(session_id, "Validation", f"Price stable for {hotel_id}. No threshold breach detected.", "info")
        
            except Exception as e:
                print(f"[AnalystAgent] Error processing {res.get('hotel_id')}: {e}")
                await self.log_reasoning(session_id, "Analysis", f"[ERROR] {str(e)}")

        # 4. Final Batch Insertions
        try:
            if price_logs_to_insert:
                self.db.table("price_logs").insert(price_logs_to_insert).execute()
            if sentiment_history_to_insert:
                self.db.table("sentiment_history").insert(
                    sentiment_history_to_insert
                ).execute()
            if alerts_to_insert:
                self.db.table("alerts").insert(alerts_to_insert).execute()
        except Exception as e:
            print(f"[AnalystAgent] Batch insert error: {e}")
            await self.log_reasoning(session_id, "Analysis", f"[CRITICAL] Batch insert failed: {str(e)}")

        # EXPLANATION: Parallel Embedding Generation (2026 Optimization)
        # Instead of slowing down the main analysis loop, we process all queued
        # embeddings in parallel at the end. This typically saves 2-10s per scan.
        if hasattr(self, "_embedding_queue") and self._embedding_queue:
            try:
                embedding_tasks = []
                for hotel_id, meta in self._embedding_queue:
                    embedding_tasks.append(
                        self._update_sentiment_embedding(hotel_id, meta)
                    )

                print(
                    f"[AnalystAgent] Processing {len(embedding_tasks)} embeddings in parallel..."
                )
                results = await asyncio.gather(*embedding_tasks, return_exceptions=True)

                # Update statuses based on results
                for i, res in enumerate(results):
                    hotel_id, _ = self._embedding_queue[i]
                    status = "current" if res is True else "failed"
                    self.db.table("hotels").update({"embedding_status": status}).eq(
                        "id", hotel_id
                    ).execute()

                await self.log_reasoning(session_id, "Analysis", 
                    f"[Embedding] Parallel processing complete for {len(embedding_tasks)} profiles."
                )
                # Clear queue for next run
                self._embedding_queue = []
            except Exception as e:
                print(f"[AnalystAgent] Parallel embedding error: {e}")
                await self.log_reasoning(session_id, "Analysis", 
                    f"[Embedding] Parallel processing failed: {str(e)}"
                )

        # 5. Market Intelligence (ADK Agent Activation)
        # Use the MarketIntelligenceAgent to perform a high-level review of all gathered results.
        try:
            # KAİZEN: Resilience against 503 Capacity Errors
            # If the Gemini API is overloaded, we fall back to a heuristic analysis 
            # instead of crashing the scan session.
            try:
                avg_vol = float(sum(volatilities) / len(volatilities)) if volatilities else 0.0
                intel_res = await self.adk_agent.run_analysis(scraper_results, threshold, volatility=avg_vol)
                intel_trace = intel_res.get("reasoning") or []
            except Exception as adk_e:
                import time
                error_msg = str(adk_e)
                if "503" in error_msg or "capacity" in error_msg.lower():
                    await self.log_reasoning(session_id, "Market Intel", 
                        "AI Strategy Server is currently at capacity. Falling back to heuristic mode.", "warning"
                    )
                    err_str = str(error_msg or "")
                    # Explicit slice to satisfy strict linter
                    safe_msg = err_str[0:50]
                    await self.log_reasoning(session_id, "Market Intel", 
                        f"AI analysis bypassed due to temporary service issue: {safe_msg}...", "warning"
                    )
                
                # Heuristic Fallback reasoning
                intel_trace = [
                    {
                        "step": "Market Intel",
                        "level": "info",
                        "message": "Heuristic Check: Analyzing price movements without AI assistance.",
                        "timestamp": time.time()
                    },
                    {
                        "step": "Market Intel",
                        "level": "info",
                        "message": "Validation complete: Base market logic applied despite AI unavailability.",
                        "timestamp": time.time()
                    }
                ]
            
            if session_id:
                if str(session_id) not in self._log_buffer:
                    self._log_buffer[str(session_id)] = []
                # Inject Market Intelligence reasoning into the session trace
                self._log_buffer[str(session_id)].extend(intel_trace)
        except Exception as e:
            print(f"[AnalystAgent] Global Intel Error: {e}")
            await self.log_reasoning(session_id, "Market Intel", "[Skip] Strategic analysis bypassed.")

        # 6. Reasoning Trace persistence
        if session_id:
            await self._flush_logs(session_id)

        # 6. Final Global Pulse Dispatch
        # Aggregates notifications for all rivals across the entire scan.
        if pulse_queue:
            asyncio.create_task(self._pulse_batch_global_alerts(user_id, pulse_queue))

        return analysis_summary

    def _get_hotels(self, user_id: UUID):
        res = self.db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        return res.data or []

    async def _pulse_batch_global_alerts(
        self, initiator_user_id: UUID, pulse_data: List[Dict[str, Any]]
    ):
        """
        Global Pulse Strategy (2026 Batching Optimization):
        Analyzes all hotel price changes in a scan session, groups them by 'Rival User',
        and sends ONE consolidated notification per user.
        """
        if not pulse_data:
            return

        print(f"[GlobalPulse] Batching pulse for {len(pulse_data)} results...")
        try:
            serp_ids = [p["serp_api_id"] for p in pulse_data]

            # 1. Find all rivals for all hotel IDs (excluding initiator)
            rivals_res = (
                self.db.table("hotels")
                .select("user_id, id, name, serp_api_id")
                .in_("serp_api_id", serp_ids)
                .neq("user_id", str(initiator_user_id))
                .execute()
            )

            if not rivals_res.data:
                return

            # Group pulse results by serp_api_id for easy lookup
            pulse_map = {str(p.get("serp_api_id") or ""): p for p in pulse_data if isinstance(p, dict)}

            # 2. Group rival users
            rival_users_map = {}  # user_id -> [list of rival hotel entries]
            for rival in rivals_res.data:
                uid = rival["user_id"]
                if uid not in rival_users_map:
                    rival_users_map[uid] = []
                rival_users_map[uid].append(rival)

            # 3. Fetch settings for all rivals at once
            all_rival_uids = list(rival_users_map.keys())
            settings_res = (
                self.db.table("settings")
                .select("*")
                .in_("user_id", all_rival_uids)
                .execute()
            )
            settings_lookup: Dict[str, Any] = {str(s.get("user_id") or ""): s for s in (settings_res.data or []) if isinstance(s, dict)}

            # 4. Fetch historical baselines for all rival hotels at once
            rival_hotel_ids = [str(r.get("id") or "") for r in (rivals_res.data or []) if isinstance(r, dict)]
            hist_res = (
                self.db.table("price_logs")
                .select("hotel_id, price, currency")
                .in_("hotel_id", rival_hotel_ids)
                .order("recorded_at", desc=True)
                .limit(len(rival_hotel_ids) * 2)
                .execute()
            )

            history_lookup = {}
            for entry in hist_res.data:
                hid = entry["hotel_id"]
                if hid not in history_lookup:
                    history_lookup[hid] = entry

            # 5. Process each rival user
            notifier = NotifierAgent()
            for uid, user_rivals in rival_users_map.items():
                user_settings = settings_lookup.get(uid)
                if not user_settings or not user_settings.get("notifications_enabled"):
                    continue

                user_alerts = []
                hotel_name_map = {}

                for rival in user_rivals:
                    if not isinstance(rival, dict): continue
                    hid = str(rival.get("id") or "")
                    serp_id = str(rival.get("serp_api_id") or "")
                    pulse = pulse_map.get(serp_id)
                    if not pulse:
                        continue

                    last_log = history_lookup.get(hid)
                    if not last_log:
                        continue

                    # Normalize prices
                    last_log = cast(Dict[str, Any], last_log)
                    curr_price = float(pulse.get("current_price") or 0.0)
                    currency = str(pulse.get("currency") or "TRY")
                    prev_price = float(last_log.get("price") or 0.0)
                    prev_curr = str(last_log.get("currency") or "TRY")

                    if currency != prev_curr:
                        prev_price = convert_currency(prev_price, prev_curr, currency)

                    threshold = 2.0
                    if user_settings is not None:
                        # Use .get() with a default, but if the value itself is None in the DB, 
                        # handle it gracefully.
                        val = user_settings.get("threshold_percent")
                        if val is not None:
                            try:
                                threshold = float(val)
                            except (ValueError, TypeError):
                                threshold = 2.0
                        
                    breach = price_comparator.check_threshold_breach(
                        curr_price, prev_price, threshold
                    )

                    if breach:
                        hotel_name = rival["name"] or pulse["hotel_name"]
                        hotel_name_map[hid] = hotel_name
                        # EXPLANATION: [Global Pulse Phase 2] — Feature A
                        # We tag cross-user alerts with "pulse_alert" type so users
                        # can distinguish network-discovered drops from their own scans.
                        # The currency field is included for proper notification formatting.
                        user_alerts.append(
                            {
                                "user_id": uid,
                                "hotel_id": hid,
                                "alert_type": "pulse_alert",
                                "message": f"[Global Pulse] {breach['message']}",
                                "old_price": prev_price,
                                "new_price": curr_price,
                                "currency": currency,
                            }
                        )

                if user_alerts:
                    # Batch Insert Alerts
                    self.db.table("alerts").insert(user_alerts).execute()

                    # Batch Dispatch Notifications
                    try:
                        await notifier.dispatch_alerts(
                            user_alerts, user_settings, hotel_name_map
                        )
                    except Exception as n_e:
                        print(f"[GlobalPulse] Batch dispatch failed for {uid}: {n_e}")

        except Exception as e:
            print(f"[GlobalPulse] Pulse failure: {e}")
            import traceback

            traceback.print_exc()

    async def discover_rivals(
        self, target_identifier: str, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Pillar 3: Autonomous Discovery.
        Uses vector search to find 'Ghost Competitors' in the directory.
        'target_identifier' can be a hotel ID (UUID) or SerpApi ID.

        2026 Update: Now filters by location (same city/region) to ensure relevant results.
        """
        try:
            # 1. Get Target Hotel Info (Try SerpApi ID first, then UUID)
            target = (
                self.db.table("hotel_directory")
                .select("*")
                .eq("serp_api_id", target_identifier)
                .execute()
            )
            if not target.data:
                # Try UUID
                try:
                    target = (
                        self.db.table("hotel_directory")
                        .select("*")
                        .eq("id", target_identifier)
                        .execute()
                    )
                except Exception:
                    target = None

            if not target or not target.data:
                # If still not found, check the user's active hotels list
                target = (
                    self.db.table("hotels")
                    .select("*")
                    .eq("id", target_identifier)
                    .execute()
                )
                if not target.data:
                    target = (
                        self.db.table("hotels")
                        .select("*")
                        .eq("serp_api_id", target_identifier)
                        .execute()
                    )

            if not target or not target.data:
                print(
                    f"[AnalystAgent] Target {target_identifier} not found for discovery."
                )
                return []

            target_data: Dict[str, Any] = (
                target.data[0]
                if target and hasattr(target, "data") and target.data
                else {}
            )
            if not target_data:
                print(f"[AnalystAgent] Target {target_identifier} has no data.")
                return []
            serp_api_id = target_data.get("serp_api_id")

            # Extract target location for filtering
            target_location = target_data.get("location", "")
            target_city = self._extract_city(target_location)

            # 2. Generate Embedding for Target (if not exists in directory yet)
            target_embedding = target_data.get("embedding")
            if not target_embedding:
                text = format_hotel_for_embedding(target_data)
                target_embedding = await get_embedding(text)

            # Get target coordinates
            target_lat = target_data.get("latitude")
            target_lng = target_data.get("longitude")

            # 3. Perform Vector Search (RPC) - request more results to filter by location
            search_limit = limit * 6  # Fetch more to filter by distance
            res = self.db.rpc(
                "match_hotels",
                {
                    "query_embedding": target_embedding,
                    "match_threshold": 0.5,
                    "match_count": search_limit,
                    "target_hotel_id": serp_api_id or str(target_data.get("id")),
                },
            ).execute()

            if not res or not hasattr(res, "data") or not res.data:
                return []

            # 4. Filter by Location (coordinates first, then fallback to string match)
            filtered_results = []
            for rival in res.data:
                rival_lat = rival.get("latitude")
                rival_lng = rival.get("longitude")

                # Try coordinate-based distance first
                if target_lat and target_lng and rival_lat and rival_lng:
                    dist_km = float(
                        self._haversine_distance(
                            float(target_lat), float(target_lng), float(rival_lat), float(rival_lng)
                        )
                    )
                    # Arithmetic rounding to bypass round() overload issues
                    rival["distance_km"] = float(int(float(dist_km) * 10 + 0.5) / 10.0)

                    # Filter: only include hotels within 50km
                    if dist_km <= 25:
                        rival["location_match"] = "nearby"  # Very close
                        filtered_results.append(rival)
                    elif dist_km <= 50:
                        rival["location_match"] = "region"  # Same region
                        filtered_results.append(rival)
                    # Skip hotels > 50km away
                else:
                    # Fallback to string-based location matching
                    rival_location = rival.get("location", "")
                    rival_city = self._extract_city(rival_location)

                    if target_city and rival_city:
                        if target_city.lower() == rival_city.lower():
                            rival["location_match"] = "city"
                            filtered_results.append(rival)
                        elif self._same_region(target_location, rival_location):
                            rival["location_match"] = "region"
                            filtered_results.append(rival)
                    elif not target_city:
                        # If we can't determine target city, include all
                        filtered_results.append(rival)

            # 5. Sort by distance (if available) then similarity
            def sort_key(r):
                distance = r.get("distance_km", 999)  # Default high for no coords
                sim = r.get("similarity", 0) or 0
                return (distance, -sim)

            filtered_results.sort(key=sort_key)

            # Ensure similarity values are valid numbers
            # Type narrowing for Pyright
            final_list = list(filtered_results)
            # Use extremely explicit type narrowing for slicing
            final_list_typed = cast(list, final_list)
            if limit > 0:
                rivals_subset = list(final_list_typed[:limit])
            else:
                rivals_subset = list(final_list_typed)
            
            for rival in rivals_subset:
                if isinstance(rival, dict):
                    if rival.get("similarity") is None:
                        rival["similarity"] = 0.0
                else:
                    # Fallback if rival is not a dict
                    pass

            return rivals_subset

        except Exception as e:
            print(f"[AnalystAgent] Discovery error: {e}")
            import traceback

            traceback.print_exc()
            return []

    def _haversine_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate distance between two points using Haversine formula. Returns km."""
        import math

        R = 6371  # Earth's radius in km

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def _extract_city(self, location: str) -> str:
        """Extract city name from location string like 'Istanbul, Turkey' or 'Balikesir, Turkey'"""
        if not location:
            return ""
        # Split by comma and take first part (usually city)
        parts = [p.strip() for p in location.split(",")]
        if parts:
            return parts[0]
        return location

    def _same_region(self, loc1: str, loc2: str) -> bool:
        """Check if two locations are in the same region/country"""
        if not loc1 or not loc2:
            return False
        # Extract country (usually last part after comma)
        parts1 = [p.strip().lower() for p in loc1.split(",")]
        parts2 = [p.strip().lower() for p in loc2.split(",")]

        if len(parts1) >= 2 and len(parts2) >= 2:
            return parts1[-1] == parts2[-1]
        return False

    async def generate_executive_briefing(
        self,
        user_id: UUID,
        target_hotel_id: str,
        rival_hotel_id: Optional[str] = None,
        days: int = 30,
        report_type: Optional[str] = "Standard Comparison",
    ) -> Dict[str, Any]:
        """
        Agentic Executive Briefing Generator.

        Orchestrates the retrieval and synthesis of market data into a high-reasoning
        executive report. This process utilizes vector similarity for competitive analysis
        and Gemini-3-Flash for narrative generation.

        Args:
            user_id: The UUID of the requesting user.
            target_hotel_id: The Supabase ID of the focus hotel.
            rival_hotel_id: Optional ID of a competitor for the "Bout" comparison.
            days: Lookback window for historical log analysis (default 30).

        Returns:
            A dictionary containing hotel metadata, calculated metrics, and the AI-generated narrative.
        """
        print(
            f"[AnalystAgent] Generating Executive Briefing for {target_hotel_id} (Days: {days})"
        )

        # 1. DATA ACQUISITION: Fetch core profiles from the 'hotels' table.
        # This includes pricing DNA and sentiment embeddings.
        target_res = (
            self.db.table("hotels")
            .select("*")
            .eq("id", target_hotel_id)
            .single()
            .execute()
        )
        target = target_res.data
        if not target:
            return {"error": "Target hotel not found"}

        rival = None
        if rival_hotel_id:
            rival_res = (
                self.db.table("hotels")
                .select("*")
                .eq("id", rival_hotel_id)
                .single()
                .execute()
            )
            rival = rival_res.data

        # 2. DATA ACQUISITION: COMPETITORS (Historical & Current)
        # Fetch all competitors for the user to determine the TRUE market average during the lookback period.
        rivals_res = (
            self.db.table("hotels")
            .select("id, name, rating, current_price, preferred_currency")
            .eq("user_id", str(user_id))
            .eq("is_target_hotel", False)
            .is_("deleted_at", "null")
            .execute()
        )
        all_rivals = rivals_res.data or []
        rival_ids = [r["id"] for r in all_rivals]

        # 3. HISTORICAL ANALYSIS: Aggregate logs within the lookback window.
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        
        # Target Logs
        target_logs_res = (
            self.db.table("price_logs")
            .select("price, currency, recorded_at, search_rank, parity_offers")
            .eq("hotel_id", target_hotel_id)
            .gte("recorded_at", cutoff)
            .order("recorded_at", desc=True)
            .execute()
        )
        target_logs = target_logs_res.data or []

        # Market Logs (Filtered to the same timeframe)
        market_logs = []
        if rival_ids:
            market_logs_res = (
                self.db.table("price_logs")
                .select("hotel_id, price, currency, recorded_at")
                .in_("hotel_id", rival_ids)
                .gte("recorded_at", cutoff)
                .execute()
            )
            market_logs = market_logs_res.data or []

        # 4. METRIC CALCULATION: Derive true benchmarks
        target_avg_price = (
            float(sum(float(entry.get("price") or 0.0) for entry in (target_logs or []))) / len(target_logs)
            if target_logs
            else float(target.get("current_price") or 0.0)
        )
        
        # TRUE Market Average (Historical baseline for the selected period)
        market_historical_avg = (
            sum(float(entry.get("price") or 0.0) for entry in market_logs) / len(market_logs)
            if market_logs
            else sum(float(r.get("current_price") or 0.0) for r in all_rivals) / len(all_rivals) if all_rivals else target_avg_price
        )

        avg_rank = 1
        rank_entries = [entry for entry in target_logs if entry.get("search_rank") is not None]
        if rank_entries:
            try:
                avg_rank = sum(float(entry.get("search_rank") or 1.0) for entry in rank_entries) / len(rank_entries)
            except (ValueError, TypeError):
                avg_rank = target.get("search_rank", 1)

        # 5. QUALITY VELOCITY: Analyze sentiment shifts over time
        sentiment_velocity = "Stable"
        historical_sentiment = []
        try:
            sent_res = (
                self.db.table("sentiment_history")
                .select("rating, recorded_at")
                .eq("hotel_id", target_hotel_id)
                .gte("recorded_at", cutoff)
                .order("recorded_at", asc=True)
                .execute()
            )
            historical_sentiment = sent_res.data or []
            if len(historical_sentiment) >= 2:
                start_rating = float(historical_sentiment[0].get("rating") or 0.0)
                end_rating = float(historical_sentiment[-1].get("rating") or 0.0)
                diff = end_rating - start_rating
                if diff > 0.1: sentiment_velocity = f"Improving (+{diff:.1f})"
                elif diff < -0.1: sentiment_velocity = f"Declining ({diff:.1f})"
        except Exception: pass

        # 4. FRICTION DETECTION: Identify OTA undercutting events.
        # A 'leak' is defined as any OTA offer price lower than the hotel's direct log price.
        parity_leaks = []
        for entry in (target_logs or []):
            if not isinstance(entry, dict): continue
            offers = entry.get("parity_offers") or []
            entry_price = float(entry.get("price") or 0.0)
            for o in cast(List, offers):
                if not isinstance(o, dict): continue
                o_price = float(o.get("price") or 0.0)
                if o_price > 0 and o_price < entry_price:
                    parity_leaks.append(
                        {
                            "date": str(entry.get("recorded_at") or "")[0:10],
                            "vendor": str(o.get("vendor", "OTA")),
                            "leak_price": o_price,
                            "direct_price": entry["price"],
                        }
                    )

        # 5. SEMANTIC BENCHMARKING (The "Bout"): Calculate cosine similarity between embeddings.
        # This determines how closely the market perceives the two hotels based on review sentiment.
        similarity = 0.0
        if (
            target
            and rival
            and target.get("sentiment_embedding")
            and rival.get("sentiment_embedding")
        ):
            import numpy as np
            import json

            # EXPLANATION: Unicode Serialization Fix
            # Supabase/Postgres may return the vector as a serialized JSON string
            # instead of a Python list. We force-decode it to prevent 'ufunc multiply'
            # errors on Unicode types.
            v1_raw = target.get("sentiment_embedding")
            v2_raw = rival.get("sentiment_embedding")

            v1_list = json.loads(v1_raw) if isinstance(v1_raw, str) else v1_raw
            v2_list = json.loads(v2_raw) if isinstance(v2_raw, str) else v2_raw

            v1 = np.array(v1_list, dtype=np.float32)
            v2 = np.array(v2_list, dtype=np.float32)

            # Ensure vectors are non-zero before calculation to avoid NaN
            if v1.any() and v2.any():
                similarity = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

        # 5.5 ENRICHMENT: Compute derived fields for the frontend.
        # These power the price trend sparkline, competitor comparison table,
        # revenue projection cards, and dynamic context-aware descriptions.

        # A) Price History — chronological array for sparkline rendering
        price_history = []
        for entry in reversed(target_logs or []):
            if not isinstance(entry, dict): continue
            recorded_at_str = str(entry.get("recorded_at") or "")
            price_history.append({
                "date": str(recorded_at_str)[0:10],
                "price": float(entry.get("price") or 0.0),
            })

        # B) Price Trend — direction and magnitude over the lookback window
        price_trend = {"direction": "stable", "change_pct": 0.0}
        if len(target_logs or []) >= 2:
            newest = float(target_logs[0].get("price") or 0.0)
            oldest = float(target_logs[-1].get("price") or 0.0)
            if oldest > 0:
                pct_val = ((newest - oldest) / oldest) * 100
                pct = float(int(pct_val * 10 + 0.5) / 10.0)
                price_trend = {
                    "direction": "up" if pct > 1 else ("down" if pct < -1 else "stable"),
                    "change_pct": pct,
                }

        # C) Competitor Table — benchmarking against ALL rivals
        competitor_table = []
        target_price_raw = target.get("current_price") or target_avg_price or 0.0
        target_price = float(target_price_raw)
        for comp in all_rivals:
            comp_price_raw = comp.get("current_price") or 0.0
            comp_price = float(comp_price_raw)
            gap_pct = 0.0
            if target_price > 0 and comp_price > 0:
                gap_val = float(((target_price - comp_price) / target_price) * 100)
                gap_pct = float(int(gap_val * 10 + 0.5) / 10.0)
            competitor_table.append({
                "name": str(comp.get("name") or "Unknown"),
                "price": comp_price,
                "rating": float(comp.get("rating") or 0.0),
                "currency": str(comp.get("preferred_currency", "TRY")),
                "gap_pct": gap_pct,
            })

        # D) Revenue Projection — scale daily parity risk to monthly
        leak_diffs = []
        for leak in (parity_leaks or []):
            if isinstance(leak, dict):
                d_price = float(leak.get("direct_price") or 0.0)
                l_price = float(leak.get("leak_price") or 0.0)
                leak_diffs.append(d_price - l_price)
        
        daily_leak_amount = float(sum(leak_diffs))
        
        # Normalize by number of days with leaks
        unique_leak_days = len(set(str(l.get("date") or "") for l in parity_leaks if isinstance(l, dict) and l.get("date"))) if parity_leaks else 0
        avg_daily_leak_raw = float(daily_leak_amount / max(unique_leak_days, 1))
        avg_daily_leak = float(int(avg_daily_leak_raw * 100 + 0.5) / 100.0)

        # E) Dynamic Description Base (will be specialized below)
        total_competitors = len(competitor_table)
        yield_text = "Analyzing channel parity integrity."
        battlefield_text = f"Analyzing market position for {target.get('name')}."

        # 6. AI SYNTHESIS: Generate a high-depth executive narrative using Gemini-3-Flash.
        from backend.services.analysis_service import get_genai_client

        client = get_genai_client()

        # KAİZEN: Sentiment Summary for AI Context
        sentiment_summary = "N/A"
        try:
            if target.get("sentiment_breakdown"):
                sb_raw = target.get("sentiment_breakdown")
                if isinstance(sb_raw, list):
                    sb_list = cast(List[Dict[str, Any]], sb_raw)
                    # Use explicit slicing on typed list
                    sliced_sb = sb_list[:15]
                    sentiment_summary = ", ".join(
                        [
                            f"{str(s.get('name') or 'General')}: {s.get('score', s.get('positive', 0))}"
                            for s in sliced_sb if isinstance(s, dict)
                        ]
                    )
                elif isinstance(sb_raw, dict):
                    sentiment_summary = str(sb_raw)
        except Exception:
            pass

        final_report_type = report_type or (
            "Head-to-Head Comparison" if rival else "Strategic Market Pulse"
        )
        timeframe = f"Last {days} Days"

        metrics = {
            "target_avg_price": float(int(float(target_avg_price) * 100 + 0.5) / 100.0),
            "market_avg_price": float(int(float(market_historical_avg) * 100 + 0.5) / 100.0),
            "avg_price": float(int(float(market_historical_avg) * 100 + 0.5) / 100.0),  # KEY ALIGNMENT: Frontend 'Bench ADR' expects this
            "avg_rank": float(int(float(avg_rank) * 10 + 0.5) / 10.0),
            "gri": float(target.get("rating") or 0.0),
            "sentiment_velocity": float(sentiment_velocity) if sentiment_velocity is not None else 0.0,
            "parity_leaks_count": len(parity_leaks),
            "parity_leaks": list(parity_leaks)[0:10],
            "bout_similarity": float(int(float(similarity) * 1000 + 0.5) / 10.0) if rival else None,
            "sentiment_snapshot": sentiment_summary,
            "price_history": list(cast(list, price_history)),
            "price_trend": dict(cast(dict, price_trend)),
            "competitor_table": list(cast(list, competitor_table)),
            "revenue_projection": {
                "daily_risk": float(round(float(avg_daily_leak), 0)),
                "monthly_risk": float(round(float(avg_daily_leak) * 30, 0)),
                "leak_events": len(parity_leaks),
                "currency": str(target.get("preferred_currency", "TRY")),
            },
            "battlefield_text": battlefield_text,
            "yield_text": yield_text,
            "report_type": report_type or "Strategic Market Pulse",
            "focus_hotel_rate": float(target.get("current_price") or target_avg_price or 0.0),
        }

        briefing_payload = {
            "target": target,
            "rival": rival,
            "context": {
                "report_type": final_report_type,
                "timeframe": timeframe,
                "scope": f"Analyzing {target.get('name', 'Hotel')} vs {rival.get('name', 'Market') if isinstance(rival, dict) else 'Market'}",
            },
            "metrics": metrics,
            "narrative_raw": "",
        }

        if not client:
            # KAİZEN: Heuristic Fallback for SDK-less environments (e.g. Vercel)
            briefing_payload["narrative_raw"] = self._generate_heuristic_narrative(briefing_payload)
            print("[AnalystAgent] Using heuristic fallback (SDK missing)")
        else:
            # KAİZEN: High-Depth Strategy Prompt
            dna = target.get("pricing_dna")
            dna_str = dna if isinstance(dna, str) else "Semantic Hybrid (Premium Focus)"

            if report_type == "Sentiment Deep-Dive":
                # KAİZEN: Specialized Sentiment Analysis Prompt
                breakdown = target.get("sentiment_breakdown", [])
                mentions = target.get("guest_mentions", [])
                reviews = target.get("reviews", [])

                battlefield_text = f"Experience Leader: Search Rank #{round(avg_rank)} with a rating of {target.get('rating')}. Guests value the brand heavily."
                yield_text = f"Sentiment impact on value: Guests are perceiving {target.get('rating')} quality vs {target['preferred_currency']} {target_avg_price:,.0f} price point."

                prompt = f"""
            You are a Senior Experience & Quality Consultant. Generate a High-Depth Sentiment Deep-Dive for {target["name"]}.
            TIMEFRAME: {timeframe}
            
            EXPERIENCE DATA:
            - Overall Rating: {target.get("rating")} / 5.0
            - Sentiment Pillars: {str(breakdown[:15])}
            - Guest Voices: {str(mentions[:15])}
            - Real Review Snippets: {str(reviews[:3])}
            
            MARKET CONTEXT:
            - Benchmark Pricing: {market_historical_avg:,.0f} {target.get("preferred_currency", "TRY")}
            - Search Visibility: #{avg_rank}
            
            INSTRUCTIONS:
            - Focus on GUEST PERCEPTION and OPERATIONAL EXCELLENCE.
            - Identify "Silent Killers" (negative trends) and "Brand Champions" (competitive strengths).
            - Analyze the 'Value' pillar in relation to the {market_historical_avg:,.0f} benchmark.
            - Provide in-depth explanations of WHY guests feel a certain way based on keywords.
            - Focus on long-form reasoning and high-density strategic insights.
            - Use a sharp, consultative, and highly analytical tone.
            
            REPORT SECTIONS:
            1. [Experience Snapshot]: Emotional pulse summary.
            2. [Pillar Performance]: Deep-dive into Service, Cleanliness, Location, and Value.
            3. [The Guest Voice]: Analysis of specific keywords and persistent feedback loops.
            4. [Value-Price Correlation]: Is the guest perception of 'Value' justified by the current rate?
            5. [Operational Friction]: Where the property is failing its brand promise.
            6. [Strategic Pivot]: SINGLE most impactful operational change to drive GRI growth.

            Format: Use markdown bullet points. Be punchy, professional, and dense with insight.
            """
            elif report_type == "Yield Audit":
                # KAİZEN: Specialized Revenue Leakage Prompt
                yield_text = f"Audit Alert: {len(parity_leaks)} leaks detected. Monthly risk estimated at {target['preferred_currency']} {avg_daily_leak * 30:,.0f}."
                battlefield_text = f"Visibility Risk: Search Rank #{round(avg_rank)}. Correlation between search rank and parity leakage detected."

                prompt = f"""
            You are a Forensic Revenue Auditor. Generate a High-Depth Yield Audit for {target["name"]}.
            TIMEFRAME: {timeframe}
            
            FINANCIAL CONTEXT:
            - Market Rate Benchmark: {market_historical_avg:,.0f} {target.get("preferred_currency", "TRY")}
            - Your Search Rank: #{avg_rank}
            - Parity Health: {len(parity_leaks)} leakage events detected.
            - Current Pricing DNA: {dna_str}.
            
            PARITY LEAKS DATA:
            {str(list(parity_leaks)[0:10])}
            
            INSTRUCTIONS:
            - Focus on REVENUE LEAKAGE and CHANNEL INTEGRITY.
            - Quantify the 'Yield Friction' caused by OTA undercutting.
            - Analyze the correlation between Search Rank and Parity violations.
            - Provide a deep explanation of how these leaks impact the hotel's direct booking strategy.
            - Use a rigorous, financial-focused, and directive tone with high-density analysis.
            
            REPORT SECTIONS:
            1. [Integrity Frame]: Brief summary of current market discipline.
            2. [Leakage Analysis]: Detailed breakdown of OTA undercutting events.
            3. [Visibility Impact]: How search ranking is affected by price disparity.
            4. [Revenue Attrition]: Estimated impact on direct-to-total booking ratios.
            5. [Corrective Pivot]: IMMEDIATE action to take with channel managers or OTAs.

            Format: Use markdown bullet points. Be sharp and data-driven.
            """
            elif report_type == "Competitive Battlefield":
                # KAİZEN: Specialized Competitor Comparison Prompt
                rival_name = rival.get("name", "Market") if isinstance(rival, dict) else "Market"
                battlefield_text = f"The Bout: You vs {rival_name}. Similarity: {metrics.get('bout_similarity', 0)}%."
                yield_text = f"Market Capture: High substitution risk detected at {target.get('preferred_currency', 'TRY')} {target.get('current_price', 0)} rate point."

                prompt = f"""
            You are a Senior Market Strategist. Generate a High-Depth Competitive Battlefield report for {target["name"]}.
            TIMEFRAME: {timeframe}
            
            COMPETITIVE CONTEXT (The Bout):
            - Rival: {rival["name"] if rival else "General Market"}
            - Similarity Score: {briefing_payload["metrics"].get("bout_similarity", 0)}%
            - Your Rating: {target.get("rating")} vs Rival: {rival.get("rating") if rival else "N/A"}
            - Your Price: {target.get("current_price")} vs Rival: {rival.get("current_price") if rival else "N/A"}
            
            INSTRUCTIONS:
            - Focus on SUBSTITUTION RISK and MARKET CAPTURE.
            - Analyze the "Semantic Overlap" — why would a guest choose one over the other?
            - Compare Experience Pillars (Cleanliness, Service) between the two properties.
            - Provide a deep explanation of the rival's strategy vs yours.
            - Use a competitive, sharp, and strategic tone.
            
            REPORT SECTIONS:
            1. [Battlefield Frame]: Summary of the competitive landscape.
            2. [The Bout]: Comparative analysis of strengths and vulnerabilities.
            3. [Substitution Risk]: Quantify the risk of guests switching to the rival.
            4. [Sentiment Variance]: Where do guests perceive the most difference?
            5. [Victory Pivot]: Key move to outperform the rival in the next 30 days.

            Format: Use markdown bullet points. Be punchy and professional.
            """
            else:  # Strategic Market Pulse (Default)
                battlefield_text = f"Search Rank #{round(avg_rank)} across {total_competitors + 1} assets. Period ADR: {target.get('preferred_currency', 'TRY')} {target_avg_price:,.0f}."
                if len(parity_leaks) > 0:
                    yield_text = f"{len(parity_leaks)} OTA undercutting events detected. Identifying revenue leaks."
                else:
                    yield_text = "Market parity remains healthy. No active leaks detected."

                prompt = f"""
            You are a Senior Revenue Strategist from a top-tier management consulting firm. Generate a Strategic Market Pulse for {target["name"]}.
            TIMEFRAME: {timeframe}
            
            COMMERCIAL CONTEXT:
            - Period: {timeframe}
            - Your Rating: {target.get("rating")} ({sentiment_velocity}).
            - Your Period Avg Price: {target_avg_price} {target.get("preferred_currency", "TRY")}.
            - Market Period Benchmark: {market_historical_avg} {target.get("preferred_currency", "TRY")}.
            - Your Search Rank: #{avg_rank}.
            - Rival Focal Point: {rival["name"] if rival else "None selected (General Market Mode)"}.
            - Top Sentiment: {sentiment_summary[:1000]}
            
            INSTRUCTIONS:
            - Adopt a Harvard Business Review / McKinsey tone: stark facts, highly actionable, no fluffy or conversational filler.
            - Provide forward-looking recommendations explaining exactly what to do tomorrow.
            
            STRICT REPORTING FORMAT:
            For each of the following 3 sections, format EXACTLY as requested:
            
            1. [Commercial Health]
            - **Current State:** [1 sentence fact based on GRI and Benchmark]
            - **Vulnerability:** [1 sentence identifying revenue loss or perception risk]
            - **Action Plan:** [1 sentence specific, immediate directive]
            
            2. [Visibility & Positioning]
            - **Current State:** [1 sentence fact based on Search Rank and Pricing DNA]
            - **Vulnerability:** [1 sentence identifying demand capture risk or OTA friction]
            - **Action Plan:** [1 sentence strategic pricing adjustment directive]
            
            3. [The Executive Pivot]
            - **Current State:** [1 sentence summarizing the 30-day outlook]
            - **Vulnerability:** [1 sentence on the biggest threat]
            - **Action Plan:** [1 sentence specific forward pricing recommendation (e.g., "Increase standard rate by X%")]
            
            Output ONLY the sections in markdown. No introductions, no conclusions.
            """

            try:
                # KAİZEN: gemini-3-flash-preview is the current project standard.
                # DO NOT use legacy gemini-1.5-* models here.
                print(f"[AnalystAgent] Invoking Gemini for {report_type}...")
                response = client.models.generate_content(
                    model="gemini-3-flash-preview", contents=prompt
                )
                if response and response.text:
                    briefing_payload["narrative_raw"] = response.text
                    print(f"[AnalystAgent] Narrative generated ({len(response.text)} chars)")
                else:
                    print(f"[AnalystAgent] Gemini returned an empty response.")
            except Exception as ai_e:
                print(f"[AnalystAgent] AI Narrative Generation failed: {ai_e}")
                # FALLBACK: Use heuristic if Gemini fails
                briefing_payload["narrative_raw"] = self._generate_heuristic_narrative(briefing_payload)
                print(f"[AnalystAgent] Briefing fallback engaged due to AI error: {ai_e}")

        # 7. PERSISTENCE: Save to 'reports' table for administrative review (Phase 4)
        try:
            report_id = self._save_briefing_to_db(str(user_id), briefing_payload)
            briefing_payload["report_id"] = report_id
        except Exception as db_e:
            print(f"[AnalystAgent] Briefing Save Error: {db_e}")

        return briefing_payload

    def _generate_heuristic_narrative(self, payload: Dict[str, Any]) -> str:
        """
        KAIZEN: Rule-Based Strategic Synthesis.
        Produces high-depth markdown analysis without requiring an LLM.
        """
        metrics = payload.get("metrics", {})
        target = payload.get("target", {})
        ari = metrics.get("target_avg_price", 0) / max(metrics.get("market_avg_price", 1), 1) * 100
        sent = target.get("rating", 0.0) * 20  # Scale 5.0 to 100
        rank = metrics.get("avg_rank", 10)
        leaks = metrics.get("parity_leaks_count", 0)
        report_type = metrics.get("report_type", "Standard")

        # 1. Commercial Health
        price_pos = "Premium" if ari > 105 else ("Aggressive" if ari < 95 else "Competitive")
        sent_pos = "Superior" if sent > 85 else ("At-Risk" if sent < 75 else "Stable")
        
        health_state = f"{target.get('name')} is maintaining a {price_pos} pricing stance with {sent_pos} guest perception."
        health_vuln = "Market parity issues are diluting your direct booking strength." if leaks > 0 else "Maintaining current sentiment is critical to sustaining price premiums."
        health_action = "Audit channel managers for leakages." if leaks > 3 else "Review ADR upside during high-demand clusters."

        # 2. Visibility
        vis_state = f"Search Visibility is currently sitting at #{round(rank)}."
        vis_vuln = "Low search visibility is impacting demand capture relative to market benchmarks." if rank > 5 else "High visibility is being countered by OTA price-undercutting." if leaks > 0 else "Strong visibility provides a defensive moat against rivals."
        vis_action = "Align rates with the 'Premium' DNA strategy."

        # 3. Executive Pivot
        pivot_state = "The 30-day outlook remains volatile due to competitive rate shifts."
        pivot_vuln = "Substitution risk is increasing as rivals drop rates below your current floor."
        pivot_action = f"Consider a { '5% rate decrease' if ari > 110 and sent < 80 else '3-5% increase' if ari < 95 and sent > 85 else 'rate maintenance' } strategy."

        # Structure Narrative based on Report Type
        if report_type == "Yield Audit":
            return f"""### [Integrity Frame]
* **Security:** {health_state}
* **Yield Friction:** {leaks} leakage events detected in the current window.

### [Leakage Analysis]
* **OTA Impact:** Direct logs are being undercut by {leaks} different vendors.
* **Visibility Link:** Disparity is likely contributing to your search rank of #{round(rank)}.

### [Corrective Pivot]
* **Action:** {health_action} Close high-friction channels immediately."""
            
        return f"""### [Commercial Health]
* **Current State:** {health_state}
* **Vulnerability:** {health_vuln}
* **Action Plan:** {health_action}

### [Visibility & Positioning]
* **Current State:** {vis_state}
* **Vulnerability:** {vis_vuln}
* **Action Plan:** {vis_action}

### [The Executive Pivot]
* **Current State:** {pivot_state}
* **Vulnerability:** {pivot_vuln}
* **Action Plan:** {pivot_action}"""

    def _save_briefing_to_db(self, user_id: str, payload: Dict[str, Any]) -> str:
        """
        Saves the generated briefing to the 'reports' table.
        Returns the ID of the created report.
        """
        try:
            target_name = payload["target"].get("name", "Unknown Hotel")
            rival_name = (
                payload["rival"].get("name", "N/A")
                if payload.get("rival")
                else "Market"
            )

            report_data = {
                "title": f"Agentic Briefing: {target_name} vs {rival_name}",
                "report_type": "briefing",
                "hotel_ids": [payload["target"]["id"]]
                + ([payload["rival"]["id"]] if payload.get("rival") else []),
                "period_months": 1,
                "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
                "period_end": datetime.now().isoformat(),
                "report_data": {
                    "metrics": payload["metrics"],
                    "narrative": payload["narrative_raw"],
                    "target_meta": {
                        "name": payload["target"]["name"],
                        "location": payload["target"]["location"],
                    },
                    "rival_meta": {
                        "name": payload["rival"]["name"],
                        "location": payload["rival"]["location"],
                    }
                    if payload.get("rival")
                    else None,
                    "context": payload.get("context", {}),
                },
                "created_by": user_id,
            }

            res = self.db.table("reports").insert(report_data).execute()
            if res.data:
                return res.data[0]["id"]
            return ""
        except Exception as e:
            print(f"[_save_briefing_to_db] Error: {e}")
            return ""

    async def _update_sentiment_embedding(
        self, hotel_id: str, meta_update: Dict[str, Any]
    ) -> bool:
        """Generates and saves the sentiment embedding. Returns True on success."""
        try:
            # 1. Fetch current full hotel data
            res = self.db.table("hotels").select("*").eq("id", hotel_id).execute()
            if not res.data:
                return False

            hotel = res.data[0]
            hotel.update(meta_update)

            # 2. Format profile
            name = hotel.get("name", "Unknown Hotel")
            stars = hotel.get("stars", "?")
            location = hotel.get("location", "Unknown Location")
            breakdown = hotel.get("sentiment_breakdown") or {}
            reviews = hotel.get("reviews") or []

            stats_text = ""
            if isinstance(breakdown, list):
                parts: List[str] = []
                breakdown_list = list(breakdown)
                for item in breakdown_list[0:10]:  # Top 10 categories
                    if not isinstance(item, dict): continue
                    item_dict = cast(Dict, item)
                    cat_name = str(item_dict.get("name") or item_dict.get("display_name") or "")
                    pos = float(item_dict.get("positive") or 0.0)
                    neg = float(item_dict.get("negative") or 0.0)
                    if cat_name:
                        parts.append(f"{cat_name}: +{pos}/-{neg}")
                stats_text = ", ".join(parts)
            elif isinstance(breakdown, dict):
                parts: List[str] = []
                for k, v in breakdown.items():
                    if isinstance(v, (int, float)):
                        parts.append(f"{k}: {v}")
                    elif isinstance(v, dict) and "score" in v:
                        parts.append(f"{k}: {v['score']}")
                stats_text = str(", ".join(parts))

            reviews_text = ""
            if isinstance(reviews, list):
                snippets: List[str] = []
                for r in reviews[:3]:
                    if isinstance(r, dict):
                        text = r.get("title") or r.get("snippet") or r.get("text")
                        if isinstance(text, str):
                            snippets.append(f'"{text}"')
                    elif isinstance(r, str):
                        snippets.append(f'"{r}"')
                reviews_text = str(" ".join(snippets))

            profile = f"""
Hotel: {name}
Stars: {stars}
Location: {location}
Sentiment Stats: {stats_text}
Top Reviews: {reviews_text}
            """.strip()

            # 3. Generate Embedding
            if stats_text or reviews_text:
                print(
                    f"[AnalystAgent] Generating sentiment embedding for {hotel_id}..."
                )
                embedding = await get_embedding(profile)

                if embedding and len(embedding) == 768:
                    self.db.table("hotels").update(
                        {"sentiment_embedding": embedding}
                    ).eq("id", hotel_id).execute()
                    print(f"[AnalystAgent] Saved sentiment embedding for {hotel_id}")
                    return True
                else:
                    print(
                        f"[AnalystAgent] Embedding failed or dimension mismatch for {hotel_id}"
                    )
                    return False
            return True  # Nothing to update is technically success
        except Exception as e:
            print(f"[AnalystAgent] _update_sentiment_embedding error: {e}")
            return False

    def _validate_price_drop(
        self, hotel_id: str, current_price: float, currency: str
    ) -> tuple[bool, float]:
        """
        EXPLANATION: Sudden Drop Detection Logic
        This method protects the system from price glitches by comparing the new rate
        against the last 10 successful scans for this specific hotel.

        Logic:
        1. Fetch up to 10 recent non-zero prices from 'price_logs'.
        2. Calculate the mean (average).
        3. If the NEW price is < 50% of the average, it's flagged as suspicious (False).
        """
        try:
            # Fetch last 10 valid prices for historical baseline
            res = (
                self.db.table("price_logs")
                .select("price")
                .eq("hotel_id", hotel_id)
                .eq("currency", currency)
                .gt("price", 0)
                .order("recorded_at", desc=True)
                .limit(10)
                .execute()
            )

            if not res.data:
                return True, 0.0  # No history, trust the new price as first reference

            prices = [float(r.get("price") or 0.0) for r in (res.data or []) if isinstance(r, dict)]
            if not prices:
                return True, 0.0
            avg_price = float(sum(prices)) / len(prices)

            # Threshold Check: Rejects prices falling below half of the historical average
            if current_price < (avg_price * 0.5):
                return False, avg_price

            return True, avg_price
        except Exception as e:
            print(f"[Safeguard] Error validating price: {e}")
            return True, 0.0  # Fail open if DB error to avoid blocking valid scans
