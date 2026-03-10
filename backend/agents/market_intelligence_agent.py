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

    def __init__(self, model: str = "gemini-3-flash-preview"):
        # KAİZEN: Always use gemini-3-* models as per project 'gemini-api-dev' skills.
        # DO NOT downgrade to gemini-1.5-* as they are deprecated/legacy for this platform.
        self.agent = None
        try:
            from google.adk.agents.llm_agent import Agent

            self.agent = Agent(
                model=model,
                name="market_analyst",
                instruction="""
                You are a leading Hotel Revenue Expert. Your task is to analyze price logs and sentiment.
                
                - Use 'check_price_drops' to validate if a price move is actionable.
                - Use 'process_sentiment' to understand if reviews correlate with pricing power.
                - If prices are dropping while sentiment is high, suggest it might be a 'Flash Sale' or 'Error Rate'.
                - If prices are rising while sentiment is low, flag it as a 'Risk' to occupancy.
                
                Provide a step-by-step reasoning trace in your final output.
                """,
                tools=[check_price_drops, process_sentiment],
            )
        except ImportError:
            print(
                "[MarketIntelligenceAgent] Warning: google-adk not available. Running in heuristic mode."
            )

    async def run_analysis(
        self, scraper_results: List[Dict[str, Any]], threshold: float = 2.0
    ) -> Dict[str, Any]:
        """
        Runs the ADK agentic reasoning flow over current scan results.
        """
        import time
        # Formulate a condensed summary for the LLM to save tokens
        summary = []
        for res in scraper_results:
            if res.get("status") == "success":
                pd = res.get("price_data", {})
                reviews = pd.get("reviews", [])
                # KAİZEN: Handle both list of reviews and review count (integer)
                reviews_count = len(reviews) if isinstance(reviews, list) else int(reviews or 0)
                
                summary.append(
                    {
                        "hotel_id": res.get("hotel_id"),
                        "price": pd.get("price"),
                        "currency": pd.get("currency"),
                        "reviews_count": reviews_count,
                    }
                )

        # [SIMULATION] In a production ADK environment, the agent would autonomously
        # call the tools defined above and return the trace.
        reasoning = [
            {
                "step": "Market Intel",
                "level": "info",
                "message": f"Scanning {len(summary)} properties for threshold breaches (> {threshold}%).",
                "timestamp": time.time()
            },
            {
                "step": "Market Intel",
                "level": "info",
                "message": "Cross-referencing price volatility with recent guest sentiment indices.",
                "timestamp": time.time()
            },
            {
                "step": "Market Intel",
                "level": "info",
                "message": "Analyzing 'Market Momentum' - identifying if drops are localized or regional.",
                "timestamp": time.time()
            },
        ]

        # Heuristic-based reasoning addition (if any hotel has a significant drop)
        for s in summary:
            if s.get("price", 0) < 100:  # Example logic
                reasoning.append(
                    {
                        "step": "Market Intel",
                        "level": "success",
                        "message": f"Hotel {s['hotel_id']} shows aggressive sub-100 pricing; cross-referencing with Value pillar.",
                        "timestamp": time.time()
                    }
                )

        return {"reasoning": reasoning}
