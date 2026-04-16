import time
import json
import asyncio
from typing import List, Dict, Any, cast, Optional
from backend.services.analysis_service import get_genai_client
from backend.services.ai_service import intelligence_service
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class MarketIntelligenceAgent:
    """
    AI Orchestrator using Gemini 3 (gemini-3-flash-preview).
    Provides sophisticated market reasoning traces.
    Replaces the legacy ADK-based implementation.
    """

    def __init__(self, model: str = "gemini-3-flash-preview"):
        self.model = model

    async def run_analysis(
        self, 
        scraper_results: List[Dict[str, Any]], 
        threshold: float = 2.0,
        volatility: float = 0.0
    ) -> Dict[str, Any]:
        """
        Runs the Gemini 3 agentic reasoning flow over current scan results.
        """
        import asyncio
        # 1. Prepare data summary for the agent
        summary = []
        for res in scraper_results:
            if res.get("status") == "success":
                pd = cast(Dict[str, Any], res.get("price_data") or {})
                reviews_list = cast(List[Dict[str, Any]], pd.get("reviews", []))
                reviews_to_add = reviews_list[0:3]
                summary.append({
                    "hotel_id": res.get("hotel_id"),
                    "hotel_name": res.get("hotel_name", "Unknown"),
                    "current_price": pd.get("price"),
                    "prev_price": pd.get("previous_price"),
                    "reviews": reviews_to_add
                })

        if not summary:
            return {"reasoning": [], "final_report": "No valid data to analyze.", "agentic": False}

        # 2. Get Gemini Client
        client = get_genai_client()
        if not client:
            return self._heuristic_fallback(summary, threshold, volatility)

        # 3. Agentic Execution with Gemini 3 (using Interactions API)
        try:
            prompt = f"""
            You are a Senior Hotel Revenue Architect. Analyze this market dataset and provide strategic reasoning.
            
            GOALS:
            1. Identify price anomalies (> {threshold}%).
            2. Identify the 'Behavioral Rival': Which tracked hotel has the highest correlation or most aggressive reaction to the primary hotel's price shifts?
            3. Acknowledge VOLATILITY: Mention if we are using a 'Smart Threshold' to suppress noise.
            4. Extract pricing power signals from guest sentiment.
            
            DATA: {summary}
            VOLATILITY: {volatility}% (Threshold Adjusted: {threshold}%)
            
            REQUIRED JSON STRUCTURE:
            {{
              "reasoning_trace": [{{"step": "str", "message": "str"}}],
              "behavioral_rival": {{"name": "str", "reason": "str"}},
              "final_report": "CONCISE SUMMARY WITH ALL CAPS HEADERS"
            }}
            """

            # [KAIZEN] Using generate_content API (interactions API is deprecated)
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model,
                contents=prompt
            )

            if not response or not response.text:
                raise ValueError("No output from Gemini generate_content")

            raw_text = response.text
            # Clean markdown fencing if present
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()

            raw_data = json.loads(raw_text)
            
            trace = raw_data.get("reasoning_trace", [])
            now = time.time()
            for i, item in enumerate(trace):
                item["level"] = item.get("level", "info")
                item["timestamp"] = now + (i * 0.1)

            return {
                "reasoning": trace,
                "behavioral_rival": raw_data.get("behavioral_rival"),
                "final_report": raw_data.get("final_report", ""),
                "agentic": True
            }

        except Exception as e:
            logger.error(f"[MarketIntelligenceAgent] Gemini 3 Error: {e}")
            return self._heuristic_fallback(summary, threshold, volatility)

    def _heuristic_fallback(self, summary: List[Dict[str, Any]], threshold: float, volatility: float) -> Dict[str, Any]:
        """
        Maintains the original heuristic logic as a safety net.
        """
        import time
        now = time.time()
        reasoning = [{
            "step": "Market Intel",
            "level": "info",
            "message": f"Heuristic fallback: Scanning {len(summary)} properties (Volatility: {volatility}%).",
            "timestamp": now
        }]

        for idx, s in enumerate(summary):
            try:
                cp = float(s.get("current_price") or 0.0)
                pp = float(s.get("prev_price") or 0.0)
            except (ValueError, TypeError):
                continue

            if pp > 0:
                change = abs((cp - pp) / pp) * 100
                if change > threshold:
                    reasoning.append({
                        "step": "Anomaly Detection",
                        "level": "warning",
                        "message": f"Breach for {s['hotel_name']}: {change:.1f}% change exceeds {threshold}% threshold.",
                        "timestamp": now + (idx + 1) * 0.1
                    })

        return {
            "reasoning": reasoning, 
            "final_report": "Heuristic analysis complete. No major strategic shifts detected beyond direct price alerts.",
            "agentic": False
        }

    async def synthesize_pricing_dna(self, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Synthesizes a hotel's 'Pricing DNA' from historical performance logs.
        """
        client = get_genai_client()
        if not client:
            return {"strategy": "Default", "last_updated": None}

        prompt = f"""
        You are a Strategic Revenue Architect. Analyze the following 30-day history for a hotel and define its 'Pricing DNA'.
        
        DATA: {history}
        
        GOALS:
        1. Identify the 'Strategy Archetype' (e.g. Volume Leader, Yield Seeker, Benchmark Follower).
        2. Determine 'Pricing Elasticity' based on sentiment vs price shifts.
        3. Define a 'Strategic Narrative' (2 sentences).
        
        OUTPUT JSON:
        {{
          "archetype": "str",
          "narrative": "str",
          "volatility_tolerance": "high/medium/low",
          "competitive_posture": "aggressive/neutral/passive",
          "dna_version": "1.0"
        }}
        """

        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model,
                contents=prompt
            )
            raw_text = response.text
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            dna = json.loads(raw_text)
            dna["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            return dna
        except Exception as e:
            logger.error(f"[MarketIntelligenceAgent] DNA Synthesis Error: {e}")
            return {"strategy": "Error", "error": str(e)}

    async def generate_strategy_embedding(self, dna: Dict[str, Any]) -> Optional[List[float]]:
        """
        Converts the Pricing DNA narrative into a vector embedding for retrieval grounding.
        """
        narrative = dna.get("narrative", "")
        archetype = dna.get("archetype", "")
        text_to_embed = f"Hotel Strategy: {archetype}. Perspective: {narrative}"
        
        return await intelligence_service.get_embedding(text_to_embed)
