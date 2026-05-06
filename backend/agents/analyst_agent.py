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

            # 2. Get Intelligence Metrics
            # Calculate range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            intel_res = await get_market_intelligence_data(
                user_id=user_id,
                target_hotel_id=target_hotel_id,
                start_date=start_date.strftime("%Y-%m-%d"),
                end_date=end_date.strftime("%Y-%m-%d"),
            )

            if "error" in intel_res:
                return intel_res

            metrics = intel_res.get("analysis", {})

            # 3. Augment Metrics for Report Requirements
            # If ARI or Sentiment index is missing, use defaults or calculate if possible
            ari = metrics.get("ari")
            if ari is None:
                ari = 100.0

            sent_index = metrics.get("sent_index") or 100.0

            # 4. Generate Qualitative Narrative (Verdicts)
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

            narrative = f"""
### {title}
{verdict}

Our analysis of the last {days} days indicates a {metrics.get("market_average", 0)} {target_data.get("preferred_currency", "TRY")} market baseline. 
Your Average Rate Index (ARI) of {ari:.1f} suggests a {"premium" if ari > 100 else "discounted"} stance.
            """.strip()

            # 5. Final Package
            return {
                "target": {
                    "id": target_data.get("id"),
                    "name": target_data.get("name"),
                    "preferred_currency": target_data.get("preferred_currency", "TRY"),
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
                    "market_avg_price": metrics.get("market_average", 0),
                    "target_price": metrics.get("target_price", 0),
                    "ari": ari,
                    "gri": metrics.get(
                        "sentiment_snapshot", target_data.get("rating") or 0.0
                    ),
                    "parity_leaks_count": len(
                        [
                            o
                            for o in metrics.get("price_rank", [])
                            if o.get("is_target") and o.get("offers")
                        ]
                    ),
                    "sentiment_snapshot": "Robust guest praise in Service & Cleanliness."
                    if sent_index > 100
                    else "Neutral feedback observed.",
                },
                "narrative_raw": narrative,
                "context": {
                    "report_type": report_type,
                    "analysis_days": days,
                    "generated_at": datetime.now().isoformat(),
                },
            }
        except Exception as e:
            logger.error(f"[AnalystAgent] Briefing error: {e}")
            return {"error": f"Failed to generate briefing: {str(e)}"}
