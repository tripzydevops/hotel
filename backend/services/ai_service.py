import json
import os
from typing import Dict, Any, List, Optional

# [FIX] Added typing-safe import for Google GenAI to satisfy strict linter checks
try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False
    # Mock types for internal structural compatibility if library is missing
    class MockTypes:
        def __getattr__(self, name): return None
    types = MockTypes()

from backend.utils.logger import get_logger

logger = get_logger(__name__)

class AICommanderService:
    """
    Strategic Command AI Service.
    Uses Gemini to synthesize market data into actionable intelligence.
    """

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = "gemini-2.0-flash"  # KAIZEN: Use standard flash model
        self.client = None
        
        if HAS_GENAI and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize GenAI client: {e}")
        else:
            if not self.api_key:
                logger.warning("AI_COMMANDER: GEMINI_API_KEY not found in environment.")
            if not HAS_GENAI:
                logger.warning("AI_COMMANDER: google-genai library not available.")

    async def generate_command_brief(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        KAIZEN: AI Strategist. Summarizes market data into high-level commands.
        """
        if not self.client:
            return {
                "brief": "AI Command Brief is currently unavailable (check API configuration).",
                "recommendations": [
                    "Manual Review Required",
                    "Verify GEMINI_API_KEY environment variable",
                ],
                "status": "offline",
            }

        # Prepare context from market data
        # We limit the data to avoid token bloat and focus on key metrics
        context = {
            "hotel_id": market_data.get("hotel_id"),
            "market_average": market_data.get("market_average"),
            "target_price": market_data.get("target_price"),
            "ari": market_data.get("ari"),
            "sent_index": market_data.get("sent_index"),
            "quadrant": market_data.get("quadrant_label"),
            "top_competitors": [
                {"name": h["name"], "price": h["price"], "rank": h["rank"]}
                for h in market_data.get("price_rank_list", [])[:5]
            ]
        }

        prompt = f"""
        System: You are 'Antigravity Commander', an elite AI Revenue Manager.
        Task: Analyze the following hotel market data and provide a concise Strategic Command Brief.
        Respond in strict JSON format with the following keys:
        - summary: A one-sentence high-level strategic summary.
        - tactical_actions: A list of 3 specific, actionable steps to increase RevPAR.
        - market_sentiment: A short narrative about how the market perceives this hotel relative to competitors.
        - threat_level: 'Low', 'Moderate', or 'Critical'.

        Data:
        {json.dumps(context, indent=2)}
        """

        try:
            interaction = self.client.interactions.create(
                model=self.model_name,
                input=prompt
            )
            
            response_text = interaction.outputs[-1].text
            # Clean up potential markdown formatting if Gemini includes it
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            return json.loads(response_text)
        except Exception as e:
            logger.error(f"Failed to generate AI command brief: {e}")
            return {
                "summary": "Strategic analysis engine encountered a recursive anomaly.",
                "tactical_actions": ["Review market logs manually", "Sync database state"],
                "sentiment_narrative": "Inconclusive due to processing error.",
                "threat_level": "Unknown"
            }

# Singleton instance
ai_commander = AICommanderService()
