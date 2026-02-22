import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from supabase import Client
from backend.models.schemas import ScanOptions
from backend.services.price_comparator import price_comparator
from backend.utils.embeddings import get_embedding, format_hotel_for_embedding
from backend.agents.notifier_agent import NotifierAgent
from backend.utils.helpers import convert_currency, log_query
from backend.utils.sentiment_utils import generate_mentions, normalize_sentiment, merge_sentiment_breakdowns

class AnalystAgent:
    """
    Agent responsible for market analysis, price comparison, and reasoning.
    2026 Strategy: Uses high-reasoning models (Deep Think) to explain market shifts.
    """
    def __init__(self, db: Client):
        self.db = db

    async def _log_reasoning(self, session_id: Optional[UUID], message: str):
        if not session_id: return
        try:
            # Atomic-ish append (Fetch-Modify-Update)
            res = self.db.table("scan_sessions").select("reasoning_trace").eq("id", str(session_id)).execute()
            trace = res.data[0]["reasoning_trace"] if res.data else []
            trace.append(message)
            self.db.table("scan_sessions").update({"reasoning_trace": trace}).eq("id", str(session_id)).execute()
        except: pass

    async def analyze_results(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None
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
            "target_price": None
        }
        
        reasoning_log = []
        hotel_ids = [res["hotel_id"] for res in scraper_results if res.get("hotel_id")]
        
        if not hotel_ids:
            return analysis_summary

        # 1. Pre-fetch Historical Prices for all hotels in batch
        # We fetch the last 2 logs for each hotel to compare with current
        history_map = {}
        try:
            # Note: Complex limit-per-group is hard in Supabase/PostgREST without RPC
            # For simplicity, we fetch recent logs for these hotels
            hist_res = self.db.table("price_logs") \
                .select("hotel_id, price, currency, recorded_at") \
                .in_("hotel_id", hotel_ids) \
                .order("recorded_at", desc=True) \
                .limit(len(hotel_ids) * 2) \
                .execute()
            
            for entry in hist_res.data:
                hid = entry["hotel_id"]
                if hid not in history_map:
                    history_map[hid] = []
                if len(history_map[hid]) < 2:
                    history_map[hid].append(entry)
        except Exception as e:
            print(f"[AnalystAgent] History pre-fetch warning: {e}")

        # Batch collectors
        price_logs_to_insert = []
        sentiment_history_to_insert = []
        alerts_to_insert = []
        pulse_queue = [] # Collectors for Global Pulse batching
        
        # 2. Main Analysis Loop
        for res in scraper_results:
            try:
                hotel_id = res.get("hotel_id")
                price_data = res.get("price_data")
                status = res.get("status")
                
                if not hotel_id or status != "success" or not price_data:
                    reasoning_log.append(f"[Skip] Hotel {hotel_id} - status: {status}")
                    continue

                current_price = price_data.get("price", 0.0)
                currency = price_data.get("currency", "TRY")
                
                if not current_price or current_price <= 0:
                     reasoning_log.append(f"[Start] Analyzing {hotel_id}. No Price Found.")
                else:
                     # EXPLANATION: Price Sanity Safeguard
                     # This block prevents data anomalies like "1000 Points" being mistaken for "1000 TL".
                     # If the price drops too sharply compared to history, we treat it as invalid 
                     # to trigger the 'Smart Continuity' fallback instead.
                     is_valid_drop, avg_price = self._validate_price_drop(hotel_id, current_price, currency)
                     if not is_valid_drop:
                         await self._log_reasoning(session_id, f"[Safeguard] Rejected suspicious price {current_price} {currency} (Avg: {avg_price:.2f}). Triggering fallback.")
                         reasoning_log.append(f"[Safeguard] Rejected suspicious price {current_price} {currency} (Avg: {avg_price:.2f}). Triggering fallback.")
                         current_price = 0.0 # Force continuity fallback to use historical baseline
                     else:
                          await self._log_reasoning(session_id, f"[Start] Analyzing {hotel_id}. Raw Price: {current_price} {currency}")
                          reasoning_log.append(f"[Start] Analyzing {hotel_id}. Raw Price: {current_price} {currency}")
                
                # Currency Normalization
                target_currency = options.currency if options and options.currency else "TRY"
                if currency == "USD" and target_currency == "TRY" and current_price > 0:
                    old_price = current_price
                    current_price = convert_currency(current_price, "USD", "TRY")
                    currency = "TRY"
                    reasoning_log.append(f"[Normalization] Converted {old_price} USD -> {current_price} TRY")

                check_in = res.get("check_in")
                if not check_in:
                    check_in = datetime.now().date()
                check_in_str = check_in.isoformat() if hasattr(check_in, "isoformat") else str(check_in)
                
                # EXPLANATION: Smart Continuity (Vertical Fill Persistence)
                # User Requirement: "if the scan fails or has no price then look back at the last successful price... up to 7 days back"
                # We enforce this at the database level so the data is permanently fixed, not just guessed at read time.
                is_estimated = False
                
                if (not current_price or current_price <= 0):
                    reasoning_log.append(f"[Continuity] Price missing for {hotel_id} on {check_in_str}. Checking history...")
                    try:
                        # Look for the most recent price for THIS specific check-in date
                        # Window: 7 days back from now
                        cutoff = (datetime.now() - timedelta(days=7)).isoformat()
                        
                        history_res = self.db.table("price_logs") \
                            .select("price, currency, recorded_at, vendor, parity_offers, room_types") \
                            .eq("hotel_id", hotel_id) \
                            .eq("check_in_date", check_in_str) \
                            .gt("recorded_at", cutoff) \
                            .order("recorded_at", desc=True) \
                            .limit(1) \
                            .execute()
                        
                        if history_res.data:
                            last_valid = history_res.data[0]
                            current_price = last_valid["price"]
                            currency = last_valid["currency"]
                            # KAİZEN: Continuity Metadata Persistence
                            # Copy critical metadata from historical logs to maintain dashboard accuracy.
                            price_data["vendor"] = last_valid.get("vendor") or price_data.get("vendor")
                            price_data["offers"] = last_valid.get("parity_offers") or []
                            price_data["room_types"] = last_valid.get("room_types") or []
                            is_estimated = True # Mark as estimated
                            reasoning_log.append(f"[Continuity] Found historical price for SAME date: {current_price} {currency} from {last_valid['recorded_at']}")
                            
                            # KAİZEN: UI Persistence
                            # Log this fallback to query_logs so the ScanSessionModal shows accurate vendor/price counts.
                            if session_id:
                                await log_query(
                                    db=self.db,
                                    user_id=user_id,
                                    hotel_name=res.get("hotel_name", "Hotel"),
                                    location=res.get("location"),
                                    action_type="monitor_fallback",
                                    status="success",
                                    price=current_price,
                                    currency=currency,
                                    vendor=price_data.get("vendor"),
                                    session_id=session_id
                                )
                        else:
                            # [FALLBACK LEVEL 2] Look for ANY recent price for this hotel (ignoring check-in date)
                            # This covers the "Check-In Date Rolling" scenario
                            history_any_res = self.db.table("price_logs") \
                                .select("price, currency, recorded_at, check_in_date, vendor, parity_offers, room_types") \
                                .eq("hotel_id", hotel_id) \
                                .gt("recorded_at", cutoff) \
                                .order("recorded_at", desc=True) \
                                .limit(1) \
                                .execute()

                            if history_any_res.data:
                                last_any = history_any_res.data[0]
                                current_price = last_any["price"]
                                currency = last_any["currency"]
                                # KAİZEN: Continuity Metadata Persistence
                                price_data["vendor"] = last_any.get("vendor") or price_data.get("vendor")
                                price_data["offers"] = last_any.get("parity_offers") or []
                                price_data["room_types"] = last_any.get("room_types") or []
                                is_estimated = True
                                reasoning_log.append(f"[Continuity] Found recent price for different date ({last_any.get('check_in_date')}): {current_price} {currency}")

                                # KAİZEN: UI Persistence
                                if session_id:
                                    await log_query(
                                        db=self.db,
                                        user_id=user_id,
                                        hotel_name=res.get("hotel_name", "Hotel"),
                                        location=res.get("location"),
                                        action_type="monitor_fallback_any",
                                        status="success",
                                        price=current_price,
                                        currency=currency,
                                        vendor=price_data.get("vendor"),
                                        session_id=session_id
                                    )
                            else:
                                current_price = 0.0 # Explicitly set to 0 to indicate failure
                                reasoning_log.append(f"[Continuity] No history found within 7 days. recording as Verification Failed.")
                    except Exception as e:
                        print(f"[AnalystAgent] Continuity lookup failed: {e}")

                # KAİZEN: Market Depth Safeguard
                # Detects if we are getting "shallow" results compared to historical volume.
                offers = price_data.get("offers", [])
                is_shallow = False
                if len(offers) < 5 and not is_estimated:
                    is_shallow = True
                    # KAİZEN: Persistence Check
                    # As per user request: a single low result might be transient, 
                    # but if it keeps happening, it's a critical logic problem.
                    try:
                        prev_res = self.db.table("price_logs").select("metadata").eq("hotel_id", hotel_id).order("recorded_at", desc=True).limit(2).execute()
                        prev_shallow_count = 0
                        for row in prev_res.data:
                            if row.get("metadata", {}).get("is_shallow"):
                                prev_shallow_count += 1
                        
                        if prev_shallow_count >= 2:
                            await self._log_reasoning(session_id, f"[CRITICAL DEGRADATION] PERSISTENT shallow extraction for {hotel_id}. 3 consecutive scans failed to capture full market depth. Investigation required.")
                        else:
                            await self._log_reasoning(session_id, f"[Data Quality Warning] Shallow market extraction for {hotel_id}: Only {len(offers)} offers found. Transient drop or low availability.")
                    except:
                        await self._log_reasoning(session_id, f"[Data Quality Warning] Shallow market extraction for {hotel_id}: Only {len(offers)} offers found.")

                # Prepare Price Log
                # KAİZEN: Use explicit hotel_id variable to prevent accidental shadowing 
                # from nested price_data objects (Global Pulse protection)
                price_logs_to_insert.append({
                    "hotel_id": hotel_id,
                    "price": current_price if current_price else 0.0,
                    "currency": currency,
                    "check_in_date": check_in_str,
                    "source": price_data.get("source", "serpapi"),
                    "vendor": price_data.get("vendor", "Unknown"),
                    "search_rank": price_data.get("search_rank"),
                    "parity_offers": offers,
                    "room_types": price_data.get("room_types", []),
                    "is_estimated": is_estimated,
                    "serp_api_id": price_data.get("property_token") or price_data.get("serp_api_id"),
                    "metadata": {
                        "is_shallow": is_shallow,
                        "extraction_depth": len(offers)
                    }
                })

                analysis_summary["prices_updated"] += 1

                # [Global Pulse] Phase 2: Collect pulse data for batching
                if current_price and current_price > 0: # and not is_estimated:
                    serp_api_id = price_data.get("property_token") or price_data.get("serp_api_id")
                    if serp_api_id:
                        pulse_queue.append({
                            "serp_api_id": serp_api_id,
                            "hotel_id": hotel_id,
                            "hotel_name": res.get("hotel_name", "Hotel"),
                            "current_price": current_price,
                            "currency": currency
                        })
                
                # Prepare Metadata Update
                # Fetch existing record to ensure we have the latest breakdown for mention generation
                existing_hotel = self.db.table("hotels").select("sentiment_breakdown, image_url, image_url, rating, reviews").eq("id", hotel_id).single().execute()
                current_breakdown = existing_hotel.data.get("sentiment_breakdown") or []
                
                vendor = price_data.get("vendor") or price_data.get("source", "SerpApi")
                meta_update = {
                    "last_scan": datetime.now().isoformat(),
                    "vendor_source": vendor,
                    "embedding_status": "current" 
                }
                if current_price and current_price > 0:
                    meta_update["current_price"] = current_price
                    # meta_update["currency"] = currency # Column check
                
                # [Smart Memory - Sentiment Merging Logic]
                # EXPLANATION: We maintain historical context by merging existing
                # categories from the database with new ones from the current scan result.
                # This prevents old (but still relevant) issues from disappearing 
                # if the latest guest reviews don't mention them.
                if "reviews_breakdown" in price_data:
                    new_breakdown = price_data["reviews_breakdown"]
                    merged_breakdown = merge_sentiment_breakdowns(current_breakdown, new_breakdown)
                    meta_update["sentiment_breakdown"] = merged_breakdown
                    reasoning_log.append(f"[Sentiment] Merging {len(new_breakdown)} new categories into {len(merged_breakdown)} total.")
                
                # Extract other rich fields (excluding reviews_breakdown which is merged above)
                for field in ["rating", "property_token", "image_url", "latitude", "longitude", "reviews_list", "review_count", "stars"]:
                    key = "serp_api_id" if field == "property_token" else "reviews" if field == "reviews_list" else field
                    val = price_data.get(field)
                    if val is not None:
                        meta_update[key] = val
                
                # [NEW] Generate Sentiment Voices (guest_mentions)
                # KAİZEN: Use cumulatively merged breakdown for voice generation
                calc_breakdown = meta_update.get("sentiment_breakdown") or current_breakdown
                if calc_breakdown:
                    meta_update["guest_mentions"] = generate_mentions(calc_breakdown)
                    reasoning_log.append(f"[Sentiment] Voices refreshed: {len(meta_update['guest_mentions'])} mentions")
                
                # EXPLANATION: Data Reliability Sync
                # To prevent data drift, we mark the hotel as 'stale' as soon as
                # sentiment data changes. This ensures the frontend doesn't trust
                # old AI embeddings if they haven't been regenerated yet.
                sentiment_changed = "sentiment_breakdown" in meta_update
                if sentiment_changed:
                    meta_update["embedding_status"] = "stale"
                
                # Update Hotel Metadata
                self.db.table("hotels").update(meta_update).eq("id", hotel_id).execute()
                
                # Update Sentiment Embedding (Async)
                if sentiment_changed:
                     try:
                         reasoning_log.append(f"[Embedding] Regenerating profile for {hotel_id}...")
                         success = await self._update_sentiment_embedding(hotel_id, meta_update)
                         if success:
                             self.db.table("hotels").update({"embedding_status": "current"}).eq("id", hotel_id).execute()
                             reasoning_log.append("[Embedding] Success.")
                         else:
                             self.db.table("hotels").update({"embedding_status": "failed"}).eq("id", hotel_id).execute()
                             reasoning_log.append("[Embedding] Failed - marked for retry.")
                     except Exception as e:
                         print(f"[AnalystAgent] Sentiment embedding error: {e}")
                         self.db.table("hotels").update({"embedding_status": "failed"}).eq("id", hotel_id).execute()
                         reasoning_log.append(f"[Embedding] Error: {str(e)}")
                
                # Prepare Sentiment History
                if price_data.get("rating"):
                    sentiment_history_to_insert.append({
                        "hotel_id": hotel_id,
                        "rating": price_data.get("rating"),
                        "review_count": price_data.get("review_count", 0),
                        "sentiment_breakdown": price_data.get("reviews_breakdown", []),
                        "recorded_at": datetime.now().isoformat() # [FIX] Ensure recorded_at is explicitly set for graph filtering
                    })
                    reasoning_log.append(f"[Sentiment] Prepared history for rating {price_data.get('rating')}")

                # 3. Threshold Breaches (Using pre-fetched history)
                if current_price and current_price > 0:
                    hotel_history = history_map.get(hotel_id, [])
                    if len(hotel_history) > 0:
                        # The most recent history in DB might be the one we just processed if we didn't pre-fetch BEFORE any inserts.
                        # However, since we pre-fetch at the START, hotel_history[0] is the PREVIOUS price.
                        prev_entry = hotel_history[0]
                        previous_price = prev_entry["price"]
                        previous_currency = prev_entry.get("currency", "USD")
                        
                        if currency != previous_currency:
                            previous_price = convert_currency(previous_price, previous_currency, currency)

                        alert = price_comparator.check_threshold_breach(current_price, previous_price, threshold)
                        if alert:
                            await self._log_reasoning(session_id, f"[Alert] BREACH! {current_price} vs {previous_price}")
                            alert_data = {
                                "user_id": str(user_id),
                                "hotel_id": hotel_id,
                                # "currency": currency, # Column missing in some environments
                                **alert
                            }
                            analysis_summary["alerts"].append(alert_data)
                            alerts_to_insert.append(alert_data)

            except Exception as e:
                print(f"[AnalystAgent] Error processing {res.get('hotel_id')}: {e}")
                reasoning_log.append(f"[ERROR] {str(e)}")

        # 4. Final Batch Insertions
        try:
            if price_logs_to_insert:
                self.db.table("price_logs").insert(price_logs_to_insert).execute()
            if sentiment_history_to_insert:
                self.db.table("sentiment_history").insert(sentiment_history_to_insert).execute()
            if alerts_to_insert:
                self.db.table("alerts").insert(alerts_to_insert).execute()
        except Exception as e:
            print(f"[AnalystAgent] Batch insert error: {e}")
            reasoning_log.append(f"[CRITICAL] Batch insert failed: {str(e)}")

        # EXPLANATION: Notification Dispatch (Phase 3)
        # We no longer dispatch notifications directly from AnalystAgent to avoid redundancy.
        # The MonitorService (caller) or the Scheduler handles dispatching 'analysis_summary["alerts"]' 
        # using the NotifierAgent after this method returns.
        pass


        # [REMOVED] Redundant embedding loop. 
        # Embeddings are now handled within the main loop for atomic consistency.

        # Final Cleanup
        analysis_summary["reasoning"] = reasoning_log
        
        # 5. Reasoning Trace persistence
        if session_id and reasoning_log:
            try:
                self.db.table("scan_sessions").update({"reasoning_trace": reasoning_log}).eq("id", str(session_id)).execute()
            except Exception: pass
        
        # 6. Final Global Pulse Dispatch
        # Aggregates notifications for all rivals across the entire scan.
        if pulse_queue:
            asyncio.create_task(self._pulse_batch_global_alerts(user_id, pulse_queue))

        return analysis_summary

    def _get_hotels(self, user_id: UUID):
        res = self.db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        return res.data or []

    async def _pulse_batch_global_alerts(
        self,
        initiator_user_id: UUID,
        pulse_data: List[Dict[str, Any]]
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
            rivals_res = self.db.table("hotels") \
                .select("user_id, id, name, serp_api_id") \
                .in_("serp_api_id", serp_ids) \
                .neq("user_id", str(initiator_user_id)) \
                .execute()
            
            if not rivals_res.data:
                return

            # Group pulse results by serp_api_id for easy lookup
            pulse_map = {p["serp_api_id"]: p for p in pulse_data}
            
            # 2. Group rival users
            rival_users_map = {} # user_id -> [list of rival hotel entries]
            for rival in rivals_res.data:
                uid = rival["user_id"]
                if uid not in rival_users_map:
                    rival_users_map[uid] = []
                rival_users_map[uid].append(rival)
            
            # 3. Fetch settings for all rivals at once
            all_rival_uids = list(rival_users_map.keys())
            settings_res = self.db.table("settings").select("*").in_("user_id", all_rival_uids).execute()
            settings_lookup = {s["user_id"]: s for s in settings_res.data}

            # 4. Fetch historical baselines for all rival hotels at once
            rival_hotel_ids = [r["id"] for r in rivals_res.data]
            hist_res = self.db.table("price_logs") \
                .select("hotel_id, price, currency") \
                .in_("hotel_id", rival_hotel_ids) \
                .order("recorded_at", desc=True) \
                .limit(len(rival_hotel_ids) * 2) \
                .execute()
            
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
                    hid = rival["id"]
                    serp_id = rival["serp_api_id"]
                    pulse = pulse_map.get(serp_id)
                    if not pulse: continue
                    
                    last_log = history_lookup.get(hid)
                    if not last_log: continue
                    
                    # Normalize prices
                    curr_price = pulse["current_price"]
                    currency = pulse["currency"]
                    prev_price = last_log["price"]
                    prev_curr = last_log["currency"]
                    
                    if currency != prev_curr:
                        prev_price = convert_currency(prev_price, prev_curr, currency)
                    
                    threshold = user_settings.get("threshold_percent", 2.0)
                    breach = price_comparator.check_threshold_breach(curr_price, prev_price, threshold)
                    
                    if breach:
                        hotel_name = rival["name"] or pulse["hotel_name"]
                        hotel_name_map[hid] = hotel_name
                        # EXPLANATION: [Global Pulse Phase 2] — Feature A
                        # We tag cross-user alerts with "pulse_alert" type so users
                        # can distinguish network-discovered drops from their own scans.
                        # The currency field is included for proper notification formatting.
                        user_alerts.append({
                            "user_id": uid,
                            "hotel_id": hid,
                            "alert_type": "pulse_alert",
                            "message": f"[Global Pulse] {breach['message']}",
                            "old_price": prev_price,
                            "new_price": curr_price,
                            "currency": currency
                        })

                if user_alerts:
                    # Batch Insert Alerts
                    self.db.table("alerts").insert(user_alerts).execute()
                    
                    # Batch Dispatch Notifications
                    try:
                        await notifier.dispatch_alerts(user_alerts, user_settings, hotel_name_map)
                    except Exception as n_e:
                        print(f"[GlobalPulse] Batch dispatch failed for {uid}: {n_e}")

        except Exception as e:
            print(f"[GlobalPulse] Pulse failure: {e}")
            import traceback
            traceback.print_exc()

    async def discover_rivals(self, target_identifier: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Pillar 3: Autonomous Discovery.
        Uses vector search to find 'Ghost Competitors' in the directory.
        'target_identifier' can be a hotel ID (UUID) or SerpApi ID.
        
        2026 Update: Now filters by location (same city/region) to ensure relevant results.
        """
        try:
            # 1. Get Target Hotel Info (Try SerpApi ID first, then UUID)
            target = self.db.table("hotel_directory").select("*").eq("serp_api_id", target_identifier).execute()
            if not target.data:
                # Try UUID
                try:
                    target = self.db.table("hotel_directory").select("*").eq("id", target_identifier).execute()
                except Exception:
                    target = None
            
            if not target or not target.data:
                # If still not found, check the user's active hotels list
                target = self.db.table("hotels").select("*").eq("id", target_identifier).execute()
                if not target.data:
                    target = self.db.table("hotels").select("*").eq("serp_api_id", target_identifier).execute()
                
            if not target or not target.data:
                print(f"[AnalystAgent] Target {target_identifier} not found for discovery.")
                return []
            
            target_data: Dict[str, Any] = target.data[0] if target and hasattr(target, 'data') and target.data else {}
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
            res = self.db.rpc("match_hotels", {
                "query_embedding": target_embedding,
                "match_threshold": 0.5,
                "match_count": search_limit,
                "target_hotel_id": serp_api_id or str(target_data.get("id"))
            }).execute()
            
            if not res or not hasattr(res, 'data') or not res.data:
                return []
            
            # 4. Filter by Location (coordinates first, then fallback to string match)
            filtered_results = []
            for rival in res.data:
                rival_lat = rival.get("latitude")
                rival_lng = rival.get("longitude")
                
                # Try coordinate-based distance first
                if target_lat and target_lng and rival_lat and rival_lng:
                    dist_km: float = float(self._haversine_distance(
                        target_lat, target_lng, rival_lat, rival_lng
                    ))
                    rival["distance_km"] = round(dist_km, 1)
                    
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
            rivals_subset: List[Dict[str, Any]] = filtered_results[:limit]
            for rival in rivals_subset:
                if rival.get("similarity") is None:
                    rival["similarity"] = 0.0
            
            return rivals_subset
            
        except Exception as e:
            print(f"[AnalystAgent] Discovery error: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula. Returns km."""
        import math
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
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


    async def _update_sentiment_embedding(self, hotel_id: str, meta_update: Dict[str, Any]) -> bool:
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
                parts = []
                for item in breakdown[:10]: # Top 10 categories
                    name = item.get("name") or item.get("display_name")
                    pos = item.get("positive", 0)
                    neg = item.get("negative", 0)
                    if name:
                        parts.append(f"{name}: +{pos}/-{neg}")
                stats_text = ", ".join(parts)
            elif isinstance(breakdown, dict):
                parts = []
                for k, v in breakdown.items():
                    if isinstance(v, (int, float)):
                         parts.append(f"{k}: {v}")
                    elif isinstance(v, dict) and "score" in v:
                         parts.append(f"{k}: {v['score']}")
                stats_text = str(", ".join(parts))

            reviews_text = ""
            if isinstance(reviews, list):
                snippets = []
                for r in reviews[:3]:
                    if isinstance(r, dict):
                        text = r.get("title") or r.get("snippet") or r.get("text")
                        if isinstance(text, str):
                            snippets.append(f"\"{text}\"")
                    elif isinstance(r, str):
                        snippets.append(f"\"{r}\"")
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
                print(f"[AnalystAgent] Generating sentiment embedding for {hotel_id}...")
                embedding = await get_embedding(profile)
                
                if embedding and len(embedding) == 768:
                    self.db.table("hotels").update({"sentiment_embedding": embedding}).eq("id", hotel_id).execute()
                    print(f"[AnalystAgent] Saved sentiment embedding for {hotel_id}")
                    return True
                else:
                    print(f"[AnalystAgent] Embedding failed or dimension mismatch for {hotel_id}")
                    return False
            return True # Nothing to update is technically success
        except Exception as e:
            print(f"[AnalystAgent] _update_sentiment_embedding error: {e}")
            return False

    def _validate_price_drop(self, hotel_id: str, current_price: float, currency: str) -> tuple[bool, float]:
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
            res = self.db.table("price_logs") \
                .select("price") \
                .eq("hotel_id", hotel_id) \
                .eq("currency", currency) \
                .gt("price", 0) \
                .order("recorded_at", desc=True) \
                .limit(10) \
                .execute()
            
            if not res.data:
                return True, 0.0 # No history, trust the new price as first reference
            
            prices = [r['price'] for r in res.data]
            avg_price = sum(prices) / len(prices)
            
            # Threshold Check: Rejects prices falling below half of the historical average
            if current_price < (avg_price * 0.5):
                return False, avg_price
                
            return True, avg_price
        except Exception as e:
            print(f"[Safeguard] Error validating price: {e}")
            return True, 0.0 # Fail open if DB error to avoid blocking valid scans
