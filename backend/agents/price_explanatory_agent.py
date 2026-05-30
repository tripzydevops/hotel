import asyncio
from typing import Any, Dict

from backend.utils.ai_client import get_genai_client
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)


class PriceExplanatoryAgent:
    """
    Generates natural language 'Strategic Rationals' explaining
    detected demand signals and providing actionable recommendations.
    """

    def __init__(self, db: Client):
        self.db = db

    async def generate_rationale(
        self, compression_data: Dict[str, Any], language: str = "en"
    ) -> str:
        """
        Uses Gemini 3 to generate a sharp, executive-level pulse card rationale.
        """
        city = compression_data.get("city", "Market")
        score = compression_data.get("compression_score", 0)
        signals = compression_data.get("signals", [])

        signal_str = ", ".join([f"{s['name']} ({s['type']})" for s in signals])

        # Default heuristic fallback if AI is unavailable or fails
        if language == "tr":
            fallback_msg = f"{city} bölgesinde talep sinyalleri tespit edildi. {score}/10 yoğunluk seviyesi yaklaşan hacmi gösteriyor. Fiyat yapısını gözden geçirin."
            if score > 7:
                fallback_msg = f"{city} bölgesinde kritik sıkışma riski ({score}/10). Yüksek etkinlik yoğunluğu tespit edildi. Taban ADR değerlerini korumanız önerilir."
            elif score < 4:
                fallback_msg = f"{city} bölgesinde istikrarlı talep ({score}/10). Doluluk hacmine ve standart sezonluk fiyatlandırmaya odaklanın."
        else:
            fallback_msg = f"Demand signals detected in {city}. Intensity level {score}/10 suggests upcoming volume. Review rate structure."
            if score > 7:
                fallback_msg = f"Critical compression risk in {city} ({score}/10). High event density detected. Recommend holding ADR floors."
            elif score < 4:
                fallback_msg = f"Stable demand in {city} ({score}/10). Focus on occupancy volume and standard seasonal pricing."

        client = get_genai_client()
        if not client:
            return fallback_msg

        prompt = f"""
        You are a Senior Revenue Strategist for the Turkish market. 
        Analyze the following demand signals and provide a concise, directive 'Strategic Rational'.
        
        CITY: {city}
        COMPRESSION SCORE: {score}/10
        SIGNALS DETECTED: {signal_str}
        LANGUAGE: {language}
        
        INSTRUCTIONS:
        - Respond in the language specified ({"Turkish" if language == "tr" else "English"}).
        - Use a sharp, professional, and directive tone.
        - Explain WHY the demand is shifting (e.g., 'Overlap between fair and announcement').
        - Provide a clear recommendation (e.g., 'Lock floor price at +20%' or 'Hold ADR').
        - Limit to 2 sentences.
        
        Format: "Signal Detected: [Brief summary]. Recommendation: [Action]." (In the target language)
        """

        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-3-flash-preview",
                contents=prompt,
                config={
                    "system_instruction": "You are a Senior Revenue Strategist specializing in hotel market intelligence and compression analysis."
                },
            )
            
            if response and response.text:
                return response.text.strip()
            return fallback_msg
        except Exception as e:
            logger.error(f"[PriceExplanatoryAgent] AI generation failed: {e}")
            return fallback_msg
