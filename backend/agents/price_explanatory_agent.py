from typing import List, Dict, Any
from supabase import Client
from backend.services.analysis_service import get_genai_client
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class PriceExplanatoryAgent:
    """
    Generates natural language 'Strategic Rationals' explaining 
    detected demand signals and providing actionable recommendations.
    """

    def __init__(self, db: Client):
        self.db = db

    async def generate_rationale(self, compression_data: Dict[str, Any]) -> str:
        """
        Uses Gemini 3 to generate a sharp, executive-level pulse card rationale.
        """
        client = get_genai_client()
        if not client:
            return "Unable to generate AI rationale."

        city = compression_data.get("city")
        score = compression_data.get("compression_score")
        signals = compression_data.get("signals", [])
        
        signal_str = ", ".join([f"{s['name']} ({s['type']})" for s in signals])
        
        prompt = f"""
        You are a Senior Revenue Strategist for the Turkish market. 
        Analyze the following demand signals and provide a concise, directive 'Strategic Rational'.
        
        CITY: {city}
        COMPRESSION SCORE: {score}/10
        SIGNALS DETECTED: {signal_str}
        
        INSTRUCTIONS:
        - Use a sharp, professional, and directive tone.
        - Explain WHY the demand is shifting (e.g., 'Overlap between fair and announcement').
        - Provide a clear recommendation (e.g., 'Lock floor price at +20%' or 'Hold ADR').
        - Limit to 2 sentences.
        
        Format: "Signal Detected: [Brief summary]. Recommendation: [Action]."
        """

        # KAİZEN: Always use gemini-3-* models as per project 'gemini-api-dev' skills.
        try:
            response = client.models.generate_content(
                model="gemini-3-flash-preview", contents=prompt
            )
            return response.text.strip() if response and response.text else "Market signals stable. Monitor daily."
        except Exception as e:
            logger.error(f"[PriceExplanatoryAgent] AI generation failed: {e}")
            return "Demand signals detected. Review market heatmap."
