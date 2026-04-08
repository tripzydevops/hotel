import time
from typing import List, Dict, Any, cast
from backend.services.analysis_service import get_genai_client
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
            You are a Senior Hotel Revenue Analyst. Analyze this market dataset and provide strategic reasoning.
            
            GOALS:
            1. Identify price anomalies (> {threshold}%).
            2. Extract pricing power signals from guest sentiment.
            3. Formulate a recovery or yields maximization strategy.
            
            DATA: {summary}
            VOLATILITY: {volatility}%
            
            REQUIRED JSON STRUCTURE:
            {{
              "reasoning_trace": [{"step": "str", "message": "str"}],
              "final_report": "CONCISE SUMMARY WITH ALL CAPS HEADERS"
            }}
            """

            # [KAIZEN] Offloading to thread to keep event loop live
            interaction = await asyncio.to_thread(
                client.interactions.create,
                model=self.model,
                input=prompt,
                config={'response_mime_type': 'application/json'}
            )

            if not interaction or not interaction.outputs:
                raise ValueError("No output from Gemini interactions")

            import json
            raw_data = json.loads(interaction.outputs[-1].text)
            
            trace = raw_data.get("reasoning_trace", [])
            import time
            now = time.time()
            for i, item in enumerate(trace):
                item["level"] = item.get("level", "info")
                item["timestamp"] = now + (i * 0.1)

            return {
                "reasoning": trace,
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
