import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from backend.agents.market_intelligence_agent import MarketIntelligenceAgent
from backend.models.schemas import ScanOptions
from backend.services.analysis_service import get_market_intelligence_data
from backend.services.scan_persistence import ScanPersistenceService
from backend.utils.db import get_supabase
from backend.utils.embeddings import format_hotel_for_embedding, get_embedding
from supabase import Client

logger = logging.getLogger(__name__)


class AnalystAgent:
    """
    Analyst Agent.
    Specialized in price analytics, trend detection, and multi-hotel correlation.
    """

    def __init__(self, db: Client, admin_db: Optional[Client] = None):
        self.db = db
        # Background persistence requires admin bypass for RLS on query_logs/hotels
        self.admin_db = admin_db or get_supabase(admin=True)
        self.adk_agent = MarketIntelligenceAgent()
        self.persistence = ScanPersistenceService(db, admin_insforge=self.admin_db)
        self._log_buffer = {}

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
        """Batch update the reasoning trace to the database."""
        if not session_id:
            return

        sid_key = str(session_id)
        if sid_key not in self._log_buffer or not self._log_buffer[sid_key]:
            return

        try:
            import json

            # Fetch existing trace
            existing = (
                self.admin_db.table("scan_sessions")
                .select("reasoning_trace")
                .eq("id", sid_key)
                .single()
                .execute()
            )
            raw_val = existing.data.get("reasoning_trace") if existing.data else None

            raw_trace = []
            if raw_val:
                try:
                    raw_trace = (
                        json.loads(raw_val) if isinstance(raw_val, str) else raw_val
                    )
                    if not isinstance(raw_trace, list):
                        raw_trace = []
                except Exception:
                    raw_trace = []

            # Append new logs
            raw_trace.extend(self._log_buffer[sid_key])

            self.admin_db.table("scan_sessions").update(
                {
                    "reasoning_trace": json.dumps(raw_trace),
                    "updated_at": datetime.now().isoformat(),
                }
            ).eq("id", sid_key).execute()

            # Clear buffer for this session
            self._log_buffer[sid_key] = []
        except Exception as e:
            logger.error(f"[AnalystAgent] Log flush failed: {e}")

    async def persist_results_only(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        settings: Optional[Dict[str, Any]] = None,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Phase 1: Persists raw scraper data and performs basic heuristic analysis (ARI, basic alerts).
        This must be fast and reliable.
        """
        # Persistence & Base Analysis
        # We split analysis into two distinct phases to optimize for perceived latency:
        # Phase 1 (Persistence): Saves raw data, runs heuristic alerts (ARI/Parity), and updates DB.
        # Phase 2 (Intelligence): Runs heavy LLM reasoning for strategic market advice.
        # This allows the user to see fresh data immediately while the 'AI Brain' thinks in the background.

        # 1. Persistence & Base Analysis
        analysis_summary = await self.persistence.persist_scan_results(
            user_id=user_id,
            scraper_results=scraper_results,
            threshold=threshold,
            settings=settings,
            options=options,
            session_id=session_id,
            log_reasoning_fn=self.log_reasoning,
        )

        await self._flush_logs(session_id)
        return analysis_summary

    async def run_intelligence_only(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        analysis_summary: Dict[str, Any],
        threshold: float = 2.0,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None,
    ):
        """
        Phase 2: Deep AI Reasoning (Market Intelligence).
        This is slower and uses Gemini 3.
        """
        if options and options.skip_intelligence:
            logger.info("[AnalystAgent] Skipping AI Intelligence as requested.")
            await self.log_reasoning(
                session_id, "Market Intel", "[Skip] Strategic analysis bypassed."
            )
            await self._flush_logs(session_id)
            return

        logger.info(
            f"[AnalystAgent] Starting Market Intelligence for Session {session_id}"
        )
        try:
            volatility = analysis_summary.get("volatility_avg", 0.0)
            smart_threshold = analysis_summary.get("smart_threshold", threshold)

            # Pass the adjusted threshold to the AI Agent for context
            intel_res = await self.adk_agent.run_analysis(
                scraper_results, smart_threshold, volatility=volatility
            )
            intel_trace = intel_res.get("reasoning") or []
            final_report = intel_res.get("final_report")
            behavioral_rival = intel_res.get("behavioral_rival")

            import time

            if behavioral_rival:
                intel_trace.insert(
                    0,
                    {
                        "step": "Behavioral Discovery",
                        "level": "info",
                        "message": f"Identified Behavioral Rival: {behavioral_rival.get('name')} - {behavioral_rival.get('reason')}",
                        "timestamp": time.time(),
                    },
                )

            if final_report:
                intel_trace.append(
                    {
                        "step": "Strategic Report",
                        "level": "success",
                        "message": final_report,
                        "timestamp": time.time(),
                    }
                )

            if session_id:
                sid_key = str(session_id)
                if sid_key not in self._log_buffer:
                    self._log_buffer[sid_key] = []
                self._log_buffer[sid_key].extend(intel_trace)
                await self._flush_logs(session_id)

            # Refine Pricing DNA after intelligence synthesis
            # Only refine for the primary hotel if it's a focused scan
            if scraper_results:
                primary_hotel_id = str(scraper_results[0].get("hotel_id"))
                if primary_hotel_id:
                    asyncio.create_task(
                        self._refine_pricing_dna_for_user(user_id, primary_hotel_id)
                    )
        except Exception as e:
            logger.error(f"[AnalystAgent] Intelligence Error: {e}")
            await self.log_reasoning(
                session_id,
                "Market Intel",
                f"[Error] Strategic analysis failed: {str(e)}",
            )
            await self._flush_logs(session_id)

    async def _refine_pricing_dna_for_user(self, user_id: UUID, hotel_id: str):
        """
        Background task to update a user's pricing DNA for a specific property.
        Enforces a 7-day (weekly) cooldown period.
        """
        try:
            logger.info(
                f"[AnalystAgent] Checking DNA freshness for User {user_id} -> Hotel {hotel_id}"
            )

            # 0. Check for existing profile and cooldown
            mapping_res = (
                self.admin_db.table("user_hotels")
                .select("updated_at, pricing_dna")
                .eq("user_id", str(user_id))
                .eq("hotel_id", str(hotel_id))
                .single()
                .execute()
            )

            if mapping_res.data:
                updated_at_str = mapping_res.data.get("updated_at")
                if updated_at_str and mapping_res.data.get("pricing_dna"):
                    updated_at = datetime.fromisoformat(
                        updated_at_str.replace("Z", "+00:00")
                    )
                    if datetime.now(updated_at.tzinfo) - updated_at < timedelta(days=7):
                        logger.info(
                            f"[AnalystAgent] DNA for {hotel_id} is still strategically fresh (updated {updated_at_str}). Skipping refinement."
                        )
                        return

            logger.info(
                f"[AnalystAgent] Refining Pricing DNA for User {user_id} -> Hotel {hotel_id}"
            )

            # 1. Fetch history (30d)
            thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()

            # Fetch prices and sentiment in parallel
            p_task = (
                self.admin_db.table("price_logs")
                .select("price, recorded_at")
                .eq("hotel_id", hotel_id)
                .gte("recorded_at", thirty_days_ago)
                .order("recorded_at", desc=True)
                .execute()
            )
            s_task = (
                self.admin_db.table("sentiment_history")
                .select("rating, recorded_at")
                .eq("hotel_id", hotel_id)
                .gte("recorded_at", thirty_days_ago)
                .order("recorded_at", desc=True)
                .execute()
            )

            p_res, s_res = await asyncio.gather(
                asyncio.to_thread(lambda: p_task), asyncio.to_thread(lambda: s_task)
            )

            history = {"prices": p_res.data or [], "sentiment": s_res.data or []}

            if not history["prices"]:
                return

            # 2. Synthesize
            dna = await self.adk_agent.synthesize_pricing_dna(history)
            embedding = await self.adk_agent.generate_strategy_embedding(dna)

            # 3. Apply to Mapping
            update_data = {
                "pricing_dna": dna,
                "updated_at": datetime.utcnow().isoformat(),
            }
            if embedding:
                update_data["personality_embedding"] = embedding

            self.admin_db.table("user_hotels").update(update_data).eq(
                "user_id", str(user_id)
            ).eq("hotel_id", str(hotel_id)).execute()

            logger.info(f"[AnalystAgent] Successfully refined DNA for {hotel_id}")
        except Exception as e:
            logger.error(f"[AnalystAgent] DNA Refinement failed: {e}")

    async def analyze_results(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        settings: Optional[Dict[str, Any]] = None,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Legacy wrapper for backward compatibility."""
        summary = await self.persist_results_only(
            user_id, scraper_results, threshold, settings, options, session_id
        )
        await self.run_intelligence_only(
            user_id, scraper_results, summary, threshold, options, session_id
        )

        # Dispatch pulse (internal logic preserved)
        asyncio.create_task(self._process_global_pulse(user_id, scraper_results))

        return summary

    async def _process_global_pulse(
        self, user_id: UUID, scraper_results: List[Dict[str, Any]]
    ):
        """Helper to extract pulse data and dispatch background alerts."""
        pulse_queue = []
        for res in scraper_results:
            price_data = res.get("price_data")
            if price_data and isinstance(price_data, dict):
                sid = price_data.get("serp_api_id") or price_data.get("property_token")
                if sid:
                    raw_p = price_data.get("price")
                    curr_p = float(raw_p) if raw_p is not None else 0.0
                    if curr_p > 0:
                        pulse_queue.append(
                            {
                                "serp_api_id": sid,
                                "hotel_id": res.get("hotel_id"),
                                "hotel_name": res.get("hotel_name", "Hotel"),
                                "current_price": curr_p,
                                "currency": price_data.get("currency", "TRY"),
                            }
                        )
        if pulse_queue:
            from backend.services.monitor_service import (
                _trigger_heartbeat_notifications,
            )

            for p in pulse_queue:
                await _trigger_heartbeat_notifications(
                    self.db,
                    p["hotel_id"],
                    p["current_price"],
                    p["currency"],
                    initiator_id=user_id,
                )

    async def discover_rivals(
        self, target_identifier: str, limit: int = 5, radius_km: float = 50.0
    ) -> List[Dict[str, Any]]:
        """VECTOR SEARCH Logic for ghost competitor discovery with geographical filtering."""
        try:
            # 1. Find Target (Check directory first, then user's custom hotels)
            target = (
                self.db.table("hotel_directory")
                .select("*")
                .eq("id", target_identifier)
                .execute()
            )
            if not target.data:
                target = (
                    self.db.table("hotel_directory")
                    .select("*")
                    .eq("serp_api_id", target_identifier)
                    .execute()
                )
            if not target.data:
                target = (
                    self.db.table("hotels")
                    .select("*")
                    .eq("id", target_identifier)
                    .execute()
                )

            if not target.data:
                logger.warning(
                    f"[AnalystAgent] Discovery target not found: {target_identifier}"
                )
                return []

            target_data = target.data[0]

            # Extract Coordinates
            target_lat = target_data.get("latitude")
            target_lon = target_data.get("longitude")

            # Extract target city for fallback matching to prevent semantic leakage
            target_city = None
            resolved_loc = target_data.get("resolved_location_name")
            if resolved_loc:
                target_city = resolved_loc.split(",")[0].strip()
            if not target_city and target_data.get("location"):
                target_city = target_data.get("location").split(",")[0].strip()

            # Handle Embedding (missing or zero-norm/broken)
            target_embedding = target_data.get("embedding")
            is_zero_vector = False
            if target_embedding and isinstance(target_embedding, list):
                is_zero_vector = all(v == 0 for v in target_embedding)

            if not target_embedding or is_zero_vector:
                logger.info(
                    f"[AnalystAgent] Generating missing/broken embedding for {target_data.get('name')}"
                )
                text = format_hotel_for_embedding(target_data)
                target_embedding = await get_embedding(text)

                # Update the source table to 'heal' it permanently
                try:
                    table_to_update = (
                        "hotel_directory"
                        if "location_name" in target_data
                        else "hotels"
                    )
                    self.db.table(table_to_update).update(
                        {"embedding": target_embedding}
                    ).eq("id", target_data["id"]).execute()
                except Exception as e:
                    logger.warning(
                        f"[AnalystAgent] Failed to heal embedding in DB: {e}"
                    )

            # 2. RPC Match with distance filtering
            # Ensure target_hotel_id is a valid UUID for the RPC
            try:
                target_uuid = UUID(str(target_data.get("id")))
            except (ValueError, TypeError):
                # Fallback if ID is missing or invalid (unlikely with DB constraints)
                logger.error(
                    f"[AnalystAgent] Invalid target UUID: {target_data.get('id')}"
                )
                return []

            res = self.db.rpc(
                "match_hotels",
                {
                    "query_embedding": target_embedding,
                    "match_threshold": 0.3,  # Slightly lower threshold to be more permissive with distance filtering
                    "match_count": limit
                    * 3,  # Fetch more to allow for filtering/sorting
                    "target_hotel_id": str(target_uuid),
                    "target_lat": float(target_lat) if target_lat is not None else None,
                    "target_lon": float(target_lon) if target_lon is not None else None,
                    "max_distance_km": float(radius_km),
                    "target_city": target_city,
                },
            ).execute()

            if not res.data:
                return []

            # Filter out any lingering NaN or invalid similarity scores (just in case)
            valid_results = [r for r in res.data if r.get("similarity") is not None]

            return valid_results[:limit]
        except Exception as e:
            logger.error(f"[AnalystAgent] Discovery error: {e}")
            return []

    async def generate_executive_briefing(
        self,
        user_id: UUID,
        target_hotel_id: str,
        rival_hotel_id: Optional[str] = None,
        days: int = 30,
        report_type: str = "Standard",
        locale: Optional[str] = "en",
    ) -> Dict[str, Any]:
        """
        Narrative generation (Deep Think) logic.
        Provides a comprehensive data block for PDF generation.
        """
        try:
            # 1. Fetch Hotel Objects
            target_h = (
                self.db.table("hotels").select("*").eq("id", target_hotel_id).execute()
            )
            if not target_h.data:
                return {"error": f"Target hotel {target_hotel_id} not found."}
            target_data = target_h.data[0]

            rival_data = None
            if rival_hotel_id:
                rival_h = (
                    self.db.table("hotels")
                    .select("*")
                    .eq("id", rival_hotel_id)
                    .execute()
                )
                if rival_h.data:
                    rival_data = rival_h.data[0]

            # 2. Compute rival exclusion if benchmarking a specific rival
            exclude_ids = None
            if rival_hotel_id:
                uh_res = (
                    self.db.table("user_hotels")
                    .select("hotel_id")
                    .eq("user_id", str(user_id))
                    .execute()
                )
                if uh_res.data:
                    to_exclude = [
                        item["hotel_id"]
                        for item in uh_res.data
                        if item["hotel_id"] != target_hotel_id and item["hotel_id"] != rival_hotel_id
                    ]
                    if to_exclude:
                        exclude_ids = ",".join(to_exclude)

            # 3. Get Intelligence Metrics
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            intel_res = await get_market_intelligence_data(
                db=self.db,
                user_id=str(user_id),
                start_date=start_date.strftime("%Y-%m-%d"),
                end_date=end_date.strftime("%Y-%m-%d"),
                exclude_hotel_ids=exclude_ids,
                admin_db=self.admin_db,
            )

            if "error" in intel_res:
                return intel_res

            metrics = intel_res

            # 4. Augment Metrics for Report Requirements
            ari = metrics.get("ari")
            if ari is None:
                ari = 100.0

            sent_index = metrics.get("sent_index") or metrics.get("sentiment_index") or 100.0
            target_price = metrics.get("target_price") or 0.0
            market_average = metrics.get("market_average") or 0.0
            price_rank_list = metrics.get("price_rank_list") or []
            price_history = metrics.get("price_history") or []

            # Calculate active undercuts and revenue risk
            parity_leaks_count = 0
            revenue_risk = 0.0
            if target_price > 0:
                for h in price_rank_list:
                    if not h.get("is_target") and h.get("price") and h.get("price") < target_price:
                        parity_leaks_count += 1
                        revenue_risk += (target_price - h.get("price"))

            # Calculate price trend
            price_trend = {"direction": "neutral", "change_pct": 0.0}
            if len(price_history) >= 2:
                latest_p = price_history[0].get("price", 0.0)
                oldest_p = price_history[-1].get("price", 0.0)
                if oldest_p > 0:
                    change = ((latest_p - oldest_p) / oldest_p) * 100
                    direction = "up" if change >= 1.0 else "down" if change <= -1.0 else "neutral"
                    price_trend = {"direction": direction, "change_pct": round(change, 1)}

            # Build competitor table
            competitor_table = []
            for h in price_rank_list:
                if not h.get("is_target"):
                    gap_pct = 0.0
                    if target_price > 0 and h.get("price") and h.get("price") > 0:
                        gap_pct = round(((target_price - h.get("price")) / h.get("price")) * 100, 1)
                    competitor_table.append({
                        "name": h.get("name"),
                        "price": h.get("price"),
                        "rating": h.get("rating") or 0.0,
                        "gap_pct": gap_pct
                    })

            # Calculate competitive rank
            avg_rank = 1
            for h in price_rank_list:
                if h.get("is_target"):
                    avg_rank = h.get("rank", 1)

            # Compute boutique similarity if we have embeddings and rival_data
            bout_similarity = 50.0
            if rival_data and target_data:
                target_emb = target_data.get("embedding")
                rival_emb = rival_data.get("embedding")
                if target_emb and rival_emb:
                    import math
                    try:
                        dot_product = sum(a * b for a, b in zip(target_emb, rival_emb))
                        norm_a = math.sqrt(sum(a * a for a in target_emb))
                        norm_b = math.sqrt(sum(b * b for b in rival_emb))
                        if norm_a > 0 and norm_b > 0:
                            bout_similarity = round((dot_product / (norm_a * norm_b)) * 100, 1)
                    except Exception as emb_err:
                        logger.warning(f"[AnalystAgent] Embedding similarity error: {emb_err}")

            # 5. Narrative generation via Gemini (Strategic LLM Analysis)
            from backend.utils.ai_client import get_genai_client
            client = get_genai_client()
            
            narrative = ""
            battlefield_text = ""
            yield_text = ""
            
            preferred_currency = target_data.get("preferred_currency", "TRY")
            is_tr = locale == "tr"
            language = "Turkish" if is_tr else "English"
            
            dna_text = target_data.get("pricing_dna") or "Neutral positioning"
            rival_name = rival_data.get("name") if rival_data else "Market"
            rival_rating = rival_data.get("rating", 0.0) if rival_data else 0.0
            # Get latest price for the selected rival
            rival_price = 0.0
            if rival_data:
                for h in price_rank_list:
                    if str(h.get("id")) == str(rival_hotel_id):
                        rival_price = h.get("price") or 0.0
                        break
            
            if client:
                prompt = f"""
                You are a Lead Hotel Revenue Architect for Tripzy.travel.
                Analyze the following market intelligence data for '{target_data.get("name")}' over the last {days} days:
                - Target Hotel: {target_data.get("name")} (Rating: {target_data.get("rating")}/5.0, Current Price: {target_price} {preferred_currency})
                - Benchmark Market Average Price: {market_average} {preferred_currency}
                - Competitor Count: {len(competitor_table)}
                {f"- Selected Rival Benchmarked: {rival_name} (Rating: {rival_rating}/5.0, Current Price: {rival_price} {preferred_currency})" if rival_data else ""}
                - Price Index (ARI): {ari:.1f}
                - Guest Sentiment Index: {sent_index:.1f}
                - Parity Leaks (Undercuts) Count: {parity_leaks_count}
                - Estimated Monthly Revenue Risk: {revenue_risk * 30:.2f} {preferred_currency}
                - Active Pricing Strategy Archetype: {dna_text}
                
                You are generating a briefing of type: '{report_type}'.
                
                Provide your analysis in {language}.
                
                Provide the output in JSON format with the following keys:
                - "narrative_raw": A rich, professional executive summary (2-3 paragraphs, formatted in Markdown, without using headers or bold/italic markers at the start of sentences). Focus on strategic positioning, yield optimizations, reputation leverage, and specific action steps.
                - "battlefield_text": A concise strategic commentary (1-2 sentences) about the competitive landscape, search ranking/visibility, and market share capture.
                - "yield_text": A concise strategic commentary (1-2 sentences) focused on pricing friction, rate parity leakage, or guest value perception index.
                
                Ensure the JSON is valid and strictly follows this structure.
                """
                
                models_to_try = ["gemini-3-flash-preview", "gemini-2.5-flash"]
                response = None
                for m in models_to_try:
                    try:
                        import json
                        response = await asyncio.to_thread(
                            client.models.generate_content,
                            model=m,
                            contents=prompt,
                            config={
                                "response_mime_type": "application/json"
                            }
                        )
                        if response and response.text:
                            break
                    except Exception as model_err:
                        logger.warning(f"[AnalystAgent] Model {m} failed in briefing generation: {model_err}")
                        continue
                        
                if response and response.text:
                    try:
                        import json
                        from backend.services.analysis_core import _clean_json_output
                        cleaned_json = _clean_json_output(response.text)
                        parsed = json.loads(cleaned_json)
                        narrative = parsed.get("narrative_raw", "")
                        battlefield_text = parsed.get("battlefield_text", "")
                        yield_text = parsed.get("yield_text", "")
                    except Exception as parse_err:
                        logger.error(f"[AnalystAgent] JSON parse error on GenAI response: {parse_err}")

            if not narrative:
                # Heuristic Fallback
                title = "STABLE"
                verdict = "Your pricing is currently aligned with the market average."
                if ari > 105:
                    title = "PREMIUM POSITIONING"
                    verdict = "You are currently pricing at a premium compared to the market. Guest sentiment remains strong, supporting this strategy."
                elif ari < 95:
                    title = "AGGRESSIVE CAPTURE"
                    verdict = "Your rates are significantly below market average. While this may drive occupancy, review your ADR strategy to avoid revenue leakage."

                if sent_index < 90:
                    verdict += " WARNING: Declining sentiment detected. Immediate attention to service quality required."

                if is_tr:
                    narrative = f"### {title}\n{verdict}\n\nSon {days} güne ait analizimiz, {market_average} {preferred_currency} seviyesinde bir pazar baz çizgisi göstermektedir. ARI (Ortalama Fiyat Endeksi) değeriniz olan {ari:.1f}, {'premium' if ari > 100 else 'indirimli'} bir duruşa işaret etmektedir."
                    if report_type == "Sentiment Deep-Dive":
                        battlefield_text = "Misafir memnuniyeti fiyatlandırma gücünün temel itici gücüdür."
                        yield_text = f"Memnuniyet endeksi {sent_index:.1f} seviyesinde olup, pazar ortalamasının {'üzerinde' if sent_index > 100 else 'altında'} bir performans göstermektedir."
                    elif report_type == "Yield Audit":
                        battlefield_text = "Fiyat paritesi, gelir kaybını önlemek için son derece önemlidir."
                        yield_text = f"OTA kanallarında aktif {parity_leaks_count} adet düşük fiyat tespiti yapıldı, bu durum günlük potansiyel gelir kaybına yol açmaktadır."
                    elif report_type == "Competitive Battlefield":
                        battlefield_text = f"{'Seçilen rakip' if rival_data else 'Pazar ortalaması'} karşısında doğrudan konumlandırma analizi."
                        yield_text = f"Fiyat farkı {'pozitif' if ari > 100 else 'negatif'} olup, rekabet riskini göstermektedir."
                    else:
                        battlefield_text = "Pazar fiyatlandırma sinyalleri beklenen varyasyon dahilinde sabit kalmaktadır."
                        yield_text = "Fiyat paritesi günlükleri normal bir OTA dağılımı göstermektedir."
                else:
                    narrative = f"### {title}\n{verdict}\n\nOur analysis of the last {days} days indicates a {market_average} {preferred_currency} market baseline. Your Average Rate Index (ARI) of {ari:.1f} suggests a {'premium' if ari > 100 else 'discounted'} stance."
                    if report_type == "Sentiment Deep-Dive":
                        battlefield_text = "Guest sentiment is the primary driver of pricing power."
                        yield_text = f"Sentiment index stands at {sent_index:.1f}, indicating {'above' if sent_index > 100 else 'below'} par performance."
                    elif report_type == "Yield Audit":
                        battlefield_text = "Rate parity is crucial to preventing revenue leakage."
                        yield_text = f"Detected {parity_leaks_count} active undercuts on OTAs, representing potential daily leakage."
                    elif report_type == "Competitive Battlefield":
                        battlefield_text = f"Direct positioning analysis against {'selected rival' if rival_data else 'market average'}."
                        yield_text = f"Rate gap is {'positive' if ari > 100 else 'negative'}, indexing risk."
                    else:
                        battlefield_text = "Market pricing signals remain stable within expected variance."
                        yield_text = "Parity logs indicate typical distribution of OTA rates."

            # 6. Final Package
            return {
                "target": {
                    "id": target_data.get("id"),
                    "name": target_data.get("name"),
                    "preferred_currency": preferred_currency,
                    "rating": target_data.get("rating"),
                    "review_count": target_data.get("review_count"),
                },
                "rival": {
                    "id": rival_data.get("id"),
                    "name": rival_data.get("name"),
                }
                if rival_data
                else None,
                "metrics": {
                    "report_type": report_type,
                    "market_avg_price": market_average,
                    "target_price": target_price,
                    "ari": ari,
                    "gri": sent_index,
                    "parity_leaks_count": parity_leaks_count,
                    "revenue_projection": {
                        "currency": preferred_currency,
                        "monthly_risk": round(revenue_risk * 30, 2)
                    },
                    "price_trend": price_trend,
                    "price_history": [
                        {"price": entry.get("price"), "date": entry.get("recorded_at")}
                        for entry in price_history
                    ],
                    "competitor_table": competitor_table,
                    "avg_rank": avg_rank,
                    "bout_similarity": bout_similarity,
                    "battlefield_text": battlefield_text,
                    "yield_text": yield_text,
                },
                "narrative_raw": narrative,
                "context": {
                    "report_type": report_type,
                    "analysis_days": days,
                    "timeframe": f"{days}-Day" if locale == "en" else f"{days} Günlük",
                    "generated_at": datetime.now().isoformat(),
                },
            }
        except Exception as e:
            logger.error(f"[AnalystAgent] Briefing error: {e}")
            return {"error": f"Failed to generate briefing: {str(e)}"}
