from typing import List, Dict, Any, cast, Optional
import time
import asyncio

from backend.services.price_comparator import price_comparator
from backend.utils.sentiment_utils import normalize_sentiment, generate_mentions

class MarketIntelligenceAgent:
    """
    AI Orchestrator using Google Agent Development Kit (ADK).
    Provides sophisticated market reasoning traces.
    Falls back to heuristic mode if google-adk is not installed.
    """

    def __init__(self, model: str = "gemini-2.0-flash"):
        # KAİZEN: Use gemini-2.0-flash for high-speed agentic reasoning.
        self.agent = None
        self.runner = None
        self.model = model
        
        try:
            from google.adk.agents.llm_agent import Agent
            from google.adk.runners import Runner
            from google.adk.sessions.in_memory_session_service import InMemorySessionService
            from google.adk.apps.app import App

            # Define tools for the ADK Agent
            def check_price_drops(
                current_price: float, prev_price: float, threshold: float = 2.0
            ) -> Dict[str, Any]:
                """Analyzes if a price drop exceeds the user's defined threshold."""
                return price_comparator.check_threshold_breach(current_price, prev_price, threshold)

            def process_sentiment(raw_reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
                """Extracts core sentiment pillars and keyword tags from raw review data."""
                return {
                    "pillars": normalize_sentiment(raw_reviews),
                    "voices": generate_mentions(raw_reviews),
                }

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
                
                Your response MUST briefly explain your reasoning steps.
                """,
                tools=[check_price_drops, process_sentiment],
            )

            # Setup ADK Runner infrastructure
            self.app = App(name="MarketIntelApp", root_agent=self.agent)
            self.session_service = InMemorySessionService()
            self.runner = Runner(
                app=self.app,
                session_service=self.session_service,
                auto_create_session=True
            )
            
        except ImportError:
            print(
                "[MarketIntelligenceAgent] Warning: google-adk components not available. Heuristic fallback active."
            )

    async def run_analysis(
        self, 
        scraper_results: List[Dict[str, Any]], 
        threshold: float = 2.0,
        volatility: float = 0.0
    ) -> Dict[str, Any]:
        """
        Runs the ADK agentic reasoning flow over current scan results.
        Refactored to use official 'run_async' Runner pattern.
        """
        from google.genai import types
        
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

        # 2. Agentic Execution (Correct ADK Runner Flow)
        if self.runner and summary:
            try:
                prompt = f"""
                Analyze {len(summary)} hotels. 
                Market Volatility: {volatility}%. Base Alert Threshold: {threshold}%.
                
                Data Summary: {summary}
                
                Perform a deep-dive reasoning trace using your tools and provide a final strategy report.
                """
                
                new_message = types.Content(role="user", parts=[types.Part(text=prompt)])
                
                final_text = ""
                thoughts = []
                
                # ADK iteration pattern
                async for event in self.runner.run_async(
                    user_id="system",
                    session_id=f"scan_{int(time.time())}",
                    new_message=new_message
                ):
                    # Extract final content parts
                    if event.content and event.content.parts:
                        for part in event.content.parts:
                            if part.text:
                                final_text += part.text
                    
                    # Capture thought process/reasoning if available via event structure
                    # ADK agents often surface internal reasoning in specific event types or metadata
                    if hasattr(event, "author") and event.author == self.agent.name:
                        # Logic to capture structured reasoning if provided by ADK events
                        pass

                # If we got a response, return it
                if final_text:
                    return {
                        "reasoning": thoughts if thoughts else [
                            {"step": "AI Analysis", "message": "Neural strategy engine processed scan results.", "timestamp": time.time()}
                        ],
                        "final_report": final_text,
                        "agentic": True
                    }
                    
            except Exception as e:
                print(f"[MarketIntelligenceAgent] ADK Runner Error: {e}")

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
