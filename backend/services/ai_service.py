import json
import os
from typing import Dict, Any, List, Optional

# Typing-safe import for Google GenAI to satisfy strict linter checks
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

class MarketIntelligenceService:
    """
    Market Intelligence Service.
    Uses Gemini to synthesize market data into actionable insights.
    """

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = "gemini-2.0-flash"  # Use standard flash model
        self.client = None
        
        if HAS_GENAI and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize GenAI client: {e}")
        else:
            if not self.api_key:
                logger.warning("[AI] GEMINI_API_KEY not found in environment.")
            if not HAS_GENAI:
                logger.warning("[AI] google-genai library not available.")

    async def generate_market_brief(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Summarizes market data into high-level insights using Gemini.
        """
        if not self.client:
            return {
                "brief": "Market Intelligence Brief is currently unavailable (check API configuration).",
                "strategic_actions": [
                    "Manual Review Required",
                    "Verify GEMINI_API_KEY environment variable",
                ],
                "status": "offline",
            }

        # Prepare context from market data
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
        System: You are an expert Hotel Revenue Strategy Consultant.
        Task: Analyze the following hotel market data and provide a concise Market Intelligence Brief.
        Respond in strict JSON format with the following keys:
        - summary: A one-sentence high-level strategic summary.
        - strategic_actions: A list of 3 specific, actionable steps to increase RevPAR.
        - market_sentiment: A short narrative about how the market perceives this hotel relative to competitors.
        - market_stability: 'Optimal', 'Moderate', or 'Volatile'.

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
            logger.error(f"Failed to generate intelligence brief: {e}")
            return {
                "summary": "Market intelligence engine encountered a processing error.",
                "strategic_actions": ["Review market logs manually", "Verify data integrity"],
                "market_sentiment": "Inconclusive due to processing error.",
                "market_stability": "Unknown"
            }

    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generates a vector embedding for the given text.
        """
        if not self.client:
            return None
        
        try:
            # Using text-embedding-004 which is standard for current Gemini applications
            result = self.client.models.embed_content(
                model="text-embedding-004",
                contents=text
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"[AI] Embedding failed: {e}")
            return None

# Singleton instance
intelligence_service = MarketIntelligenceService()
