import asyncio
import json
import os
# LINTER FIX: Moved imports to top of file to resolve E402
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from backend.utils.logger import get_logger

# Typing-safe import for Google GenAI to satisfy strict linter checks
from backend.utils.ai_client import get_genai_client, HAS_GENAI

try:
    from google.genai import types
except ImportError:
    # Mock types for internal structural compatibility if library is missing
    class MockTypes:
        def __getattr__(self, name):
            return None

    types = MockTypes()

# Load environment variables explicitly for the service
# Env is loaded by db.py's load_env_standard()

logger = get_logger(__name__)


class MarketIntelligenceService:
    """
    Market Intelligence Service.
    Uses Gemini to synthesize market data into actionable insights.
    """

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.model_name = "gemini-3-flash-preview"  # Upgraded to Gemini 3
        self.client = get_genai_client()
        self.sdk_available = self.client is not None

        masked_key = (
            f"{self.api_key[:4]}...{self.api_key[-4:]}"
            if self.api_key and len(self.api_key) > 8
            else "NOT-SET"
        )
        logger.info(f"[AI] Initializing Intelligence Service. Key: {masked_key}")

        if not self.client:
            if not self.api_key:
                logger.warning("[AI] API_KEY missing - running in Safe Mode.")
            if not HAS_GENAI:
                logger.warning(
                    "[AI] google-genai SDK not found - running in Safe Mode."
                )

    async def generate_market_brief(
        self, market_data: Dict[str, Any], locale: str = "en"
    ) -> Dict[str, Any]:
        """
        Summarizes market data into high-level insights using Gemini.
        """
        if not self.sdk_available or not self.client:
            return {
                "summary": "AI Synthesis is currently in Safe Mode.",
                "strategic_actions": [
                    "Perform manual data verification",
                    "Configure GEMINI_API_KEY for automated insights",
                    "Check system connectivity",
                ],
                "market_sentiment": "Sentiment analysis unavailable in Safe Mode.",
                "market_stability": "Unknown",
                "status": "safe_mode",
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
            ],
        }

        language = "Turkish" if locale == "tr" else "English"
        prompt = f"""
        System: You are an expert Hotel Revenue Strategy Consultant.
        Task: Analyze the following hotel market data and provide a concise Market Intelligence Brief.
        Respond in strict JSON format with the following keys. Translate all narrative values (summary, strategic_actions, market_sentiment) into {language}:
        - summary: A one-sentence high-level strategic summary.
        - strategic_actions: A list of 3 specific, actionable steps to increase RevPAR.
        - market_sentiment: A short narrative about how the market perceives this hotel relative to competitors.
        - market_stability: Must be exactly one of: 'Optimal', 'Moderate', or 'Volatile' (keep this stability value in English).

        Data:
        {json.dumps(context, indent=2)}
        """

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
            )
            
            response_text = response.text
            # Clean up potential markdown formatting if Gemini includes it (fallback)
            if "```json" in response_text:
                response_text = (
                    response_text.split("```json")[1].split("```")[0].strip()
                )
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            return json.loads(response_text)
        except Exception as e:
            logger.error(f"[AI] Intelligence briefing synthesis failed: {e}")
            return {
                "summary": "An error occurred during insight synthesis.",
                "strategic_actions": ["Review raw market parity logs"],
                "market_sentiment": "Unavailable",
                "market_stability": "Unknown",
            }

    async def generate_city_briefing(self, city_data: Dict[str, Any]) -> str:
        """
        Generates a city-level market briefing in Markdown format.
        """
        if not self.sdk_available or not self.client:
            return f"# Market Briefing: {city_data.get('city', 'Unknown City')}\n\n*Briefing unavailable in Safe Mode.*"

        prompt = f"""
        System: You are an expert Hotel Market Analyst.
        Task: Generate a comprehensive, professional Market Briefing for the city of {city_data.get("city")}.
        Format: Markdown.
        
        Data points to include from the provided context:
        - Total hotel count: {city_data.get("summary", {}).get("hotel_count")}
        - Average price: ${city_data.get("summary", {}).get("avg_price")}
        - Market Range: ${city_data.get("summary", {}).get("price_range", [0, 0])[0]} - ${city_data.get("summary", {}).get("price_range", [0, 0])[1]}
        - Competitor summary: {len(city_data.get("competitors", []))} active competitors tracked.
        
        Briefing sections:
        1. Market Overview
        2. Pricing Dynamics
        3. Strategic Opportunities
        4. Competitive Landscape
        5. Outlook
        
        Keep it professional, data-driven, and actionable.
        Data:
        {json.dumps(city_data, indent=2)}
        """

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config={
                    "system_instruction": "You are a senior revenue management consultant focusing on actionable, concise market intelligence."
                },
            )
            return response.text
        except Exception as e:
            logger.error(f"[AI] City briefing failed: {e}")
            return f"# {city_data.get('city', 'Market')} Briefing\n\nError synthesizing briefing text."

    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generates a vector embedding for the given text.
        """
        if not self.sdk_available or not self.client:
            return None

        try:
            # Using models/gemini-embedding-2 with 768 output dimensionality
            result = self.client.models.embed_content(
                model="models/gemini-embedding-2",
                contents=text,
                config={
                    "task_type": "RETRIEVAL_DOCUMENT",
                    "output_dimensionality": 768,
                }
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"[AI] Embedding failed: {e}")
            return None


# Singleton instance
intelligence_service = MarketIntelligenceService()
