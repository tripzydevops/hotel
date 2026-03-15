from typing import List, Dict, Any
# from google.adk.agents.llm_agent import Agent

from backend.services.price_comparator import price_comparator
from backend.utils.sentiment_utils import normalize_sentiment, generate_mentions


# Define tools for the ADK Agent
def check_price_drops(
    current_price: float, prev_price: float, threshold: float = 2.0
) -> Dict[str, Any]:
    """
    Analyzes if a price drop exceeds the user's defined threshold.
    """
    return price_comparator.check_threshold_breach(current_price, prev_price, threshold)


def process_sentiment(raw_reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extracts core sentiment pillars and keyword tags from raw review data.
    """
    return {
        "pillars": normalize_sentiment(raw_reviews),
        "voices": generate_mentions(raw_reviews),
    }


class MarketIntelligenceAgent:
    """
    AI Orchestrator using Google Agent Development Kit (ADK).
    Provides sophisticated market reasoning traces.
    Falls back to heuristic mode if google-adk is not installed.
    """

    def __init__(self, model: str = "gemini-2.0-flash"):
        # KAİZEN: Use gemini-2.0-flash for high-speed agentic reasoning.
        self.agent = None
        self.model = model
        try:
            from google.adk.agents.llm_agent import Agent

            self.agent = Agent(
                model=model,
                name="MarketIntelligenceExpert",
                instruction="""
                You are a Senior Hotel Revenue Analyst. Your goal is to synthesize pricing data and sentiment into high-level strategy.
                
                ANALYTIC FLOW:
                1. Use 'check_threshold_breach' to verify if price movements are significant.
                2. Use 'process_sentiment' to evaluate the hotel's brand strength and pricing power.
                3. Combine these signals:
                   - High Price + High Sentiment = 'Veblen Strength' (Safe to maintain rates).
                   - Low Price + High Sentiment = 'Value Opportunity' (Market capture potential).
                   - High Price + Low Sentiment = 'Yield Risk' (Potential occupancy loss).
                   - Low Price + Low Sentiment = 'Commoditized' (Race to the bottom).
                
                Your response MUST include a structured reasoning trace of your findings.
                """,
                tools=[check_price_drops, process_sentiment],
            )
        except ImportError:
            print(
                "[MarketIntelligenceAgent] Warning: google-adk not available. Heuristic fallback active."
            )

    async def run_analysis(
        self, 
        scraper_results: List[Dict[str, Any]], 
        threshold: float = 2.0,
        volatility: float = 0.0
    ) -> Dict[str, Any]:
        """
        Runs the ADK agentic reasoning flow over current scan results.
        """
        import time
        # 1. Prepare data summary for the agent
        summary = []
        for res in scraper_results:
            if res.get("status") == "success":
                pd = cast(Dict[str, Any], res.get("price_data") or {})
                summary.append({
                    "hotel_id": res.get("hotel_id"),
                    "hotel_name": res.get("hotel_name", "Unknown"),
                    "current_price": pd.get("price"),
                    "prev_price": pd.get("previous_price"),
                    "reviews": pd.get("reviews", [])[:3]
                })

        # 2. Agentic Execution (Real ADK Flow)
        if self.agent and summary:
            try:
                prompt = f"""
                Analyze {len(summary)} hotels. 
                Market Volatility: {volatility}%. Base Alert Threshold: {threshold}%.
                
                Data Summary: {summary}
                
                Perform a deep-dive reasoning trace using your tools and provide a final strategy report.
                """
                response = await self.agent.run(prompt)
                
                return {
                    "reasoning": response.thought_process if hasattr(response, "thought_process") else [],
                    "final_report": getattr(response, "content", str(response)),
                    "agentic": True
                }
            except Exception as e:
                print(f"[MarketIntelligenceAgent] ADK Error: {e}")

        # 3. Enhanced Fallback (if ADK fails or is unavailable)
        reasoning = [
            {
                "step": "Market Intel",
                "level": "info",
                "message": f"Heuristic fallback: Scanning {len(summary)} properties (Volatility: {volatility}%).",
                "timestamp": time.time()
            }
        ]

        for s in summary:
            cp = float(s.get("current_price") or 0.0)
            pp = float(s.get("prev_price") or 0.0)
            if pp > 0:
                change = abs((cp - pp) / pp) * 100
                if change > threshold:
                    reasoning.append({
                        "step": "Market Intel",
                        "level": "warning",
                        "message": f"Breach detected for {s['hotel_name']}: {change:.1f}% change exceeds {threshold}% threshold.",
                        "timestamp": time.time()
                    })

        return {"reasoning": reasoning, "agentic": False}
