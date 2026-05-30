import asyncio
import json
import os
# LINTER FIX: Moved imports to top of file to resolve E402
from typing import Any, Dict, List, Optional


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
            return self._heuristic_market_fallback(market_data, locale)

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

        models_to_try = [self.model_name, "gemini-2.5-flash"]
        seen_models = set()
        models_to_try = [x for x in models_to_try if not (x in seen_models or seen_models.add(x))]

        response_text = None
        last_error = None

        for model in models_to_try:
            try:
                logger.info(f"[AI] Attempting generate_market_brief with model: {model}")
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json"
                    }
                )
                if response and response.text:
                    response_text = response.text
                    break
            except Exception as e:
                logger.warning(f"[AI] Model {model} failed in generate_market_brief: {e}")
                last_error = e
                continue

        if response_text:
            try:
                cleaned_text = response_text
                if "```json" in cleaned_text:
                    cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
                elif "```" in cleaned_text:
                    cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
                
                # Extract clean JSON braces block if needed
                start_idx = cleaned_text.find("{")
                end_idx = cleaned_text.rfind("}")
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    cleaned_text = cleaned_text[start_idx:end_idx + 1]

                return json.loads(cleaned_text)
            except Exception as json_err:
                logger.error(f"[AI] JSON parsing failed in generate_market_brief: {json_err}. Text: {response_text}")
                last_error = json_err

        logger.error(f"[AI] All models failed in generate_market_brief. Error: {last_error}. Invoking heuristic fallback.")
        return self._heuristic_market_fallback(market_data, locale)

    def _heuristic_market_fallback(
        self, market_data: Dict[str, Any], locale: str = "en"
    ) -> Dict[str, Any]:
        """
        A high-fidelity backup rule engine that calculates strategic recommendations 
        from raw metrics when LLM endpoints are offline or regional credentials fail.
        """
        ari = market_data.get("ari")
        sent_index = market_data.get("sent_index")
        
        # Safely convert to float
        try:
            f_ari = float(ari) if ari is not None else 100.0
        except (ValueError, TypeError):
            f_ari = 100.0

        try:
            f_sent = float(sent_index) if sent_index is not None else 100.0
        except (ValueError, TypeError):
            f_sent = 100.0

        is_tr = locale == "tr"

        if f_ari >= 105 and f_sent >= 105:
            summary = (
                "Kusursuz misafir memnuniyeti sayesinde pazar ortalamasının üzerinde premium fiyatlandırma başarıyla sürdürülüyor."
                if is_tr
                else "Premium rates are successfully maintained above the market average, backed by excellent guest satisfaction."
            )
            actions = (
                [
                    "Hizmet kalitesini korumak için operasyonel standartları sürdürün.",
                    "Premium konumlandırmayı vurgulayan pazarlama kampanyaları düzenleyin.",
                    "Rakip fiyat hareketlerini ve doluluk oranlarını yakından izleyin."
                ]
                if is_tr
                else [
                    "Maintain operational standards to preserve high service quality.",
                    "Run marketing campaigns highlighting premium positioning.",
                    "Closely monitor competitor rate movements and occupancy."
                ]
            )
            sentiment = (
                "Son derece olumlu. Misafirler yüksek fiyatları sunulan üstün deneyimle uyumlu buluyor."
                if is_tr
                else "Highly positive. Guests perceive superior value, justifying the premium rate structure."
            )
            stability = "Optimal"
        elif f_ari >= 105 and f_sent < 95:
            summary = (
                "Tesis yüksek fiyat segmentinde yer alırken misafir memnuniyetinin pazarın gerisinde kalması risk oluşturuyor."
                if is_tr
                else "The hotel is positioned in a high price segment, but guest satisfaction trailing the market poses a risk."
            )
            actions = (
                [
                    "Misafir şikayetlerinin yoğunlaştığı alanlarda acil kalite denetimi yapın.",
                    "Müşteri memnuniyetini artırana kadar geçici taktiksel indirimler değerlendirin.",
                    "Ön büro ve hizmet personeline yönelik müşteri ilişkileri eğitimi planlayın."
                ]
                if is_tr
                else [
                    "Conduct an immediate quality audit in areas with high complaints.",
                    "Consider temporary tactical discounts until satisfaction improves.",
                    "Plan guest relations training for front-of-house staff."
                ]
            )
            sentiment = (
                "Riskli. Misafirler sunulan hizmet kalitesine kıyasla fiyatların aşırı yüksek olduğunu düşünüyor."
                if is_tr
                else "At risk. Guests perceive rates as overpriced relative to current service quality."
            )
            stability = "Volatile"
        elif f_ari < 95 and f_sent >= 105:
            summary = (
                "Yüksek misafir memnuniyetine rağmen fiyatların pazarın gerisinde kalması RevPAR artış fırsatı sunuyor."
                if is_tr
                else "Despite high guest satisfaction, rates trailing the market average represent a strong RevPAR growth opportunity."
            )
            actions = (
                [
                    "Fiyatları pazar ortalamasına çekmek için kademeli artışlar planlayın.",
                    "Yüksek doluluk dönemlerinde oda fiyatlarını agresif şekilde optimize edin.",
                    "Doğrudan rezervasyon kanallarında sadakat programı avantajlarını öne çıkarın."
                ]
                if is_tr
                else [
                    "Plan gradual rate increases to align closer with the market average.",
                    "Optimize rates aggressively during high-occupancy windows.",
                    "Highlight loyalty benefits on direct booking channels."
                ]
            )
            sentiment = (
                "Çok güçlü. Misafirler sunulan deneyimin ödenen ücrete göre harika bir değer sunduğunu belirtiyor."
                if is_tr
                else "Very strong. Guests note that the experience offers great value for the price paid."
            )
            stability = "Moderate"
        else:
            summary = (
                "Tesis fiyat ve memnuniyet endeksleri açısından pazar ortalamasıyla dengeli bir seyir izliyor."
                if is_tr
                else "The hotel maintains a balanced position aligned with market averages for both price and satisfaction."
            )
            actions = (
                [
                    "Sezonluk talep dalgalanmalarına göre dinamik fiyatlandırma uygulayın.",
                    "Doğrudan kanal rezervasyon oranını artırmak için özel paketler sunun.",
                    "Rakip tesislerin müşteri yorumlarındaki zayıf yönlerini analiz edin."
                ]
                if is_tr
                else [
                    "Apply dynamic pricing based on seasonal demand fluctuations.",
                    "Offer exclusive packages to boost direct booking share.",
                    "Analyze weaknesses in competitor reviews for local advantages."
                ]
            )
            sentiment = (
                "Dengeli. Pazardaki rakiplerle benzer seviyede bir müşteri memnuniyeti gözleniyor."
                if is_tr
                else "Balanced. Guest satisfaction is aligned with local competitors."
            )
            stability = "Moderate"

        return {
            "summary": summary,
            "strategic_actions": actions,
            "market_sentiment": sentiment,
            "market_stability": stability,
            "status": "heuristic_fallback",
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

        models_to_try = [self.model_name, "gemini-2.5-flash"]
        seen_models = set()
        models_to_try = [x for x in models_to_try if not (x in seen_models or seen_models.add(x))]
        
        last_error = None
        for model in models_to_try:
            try:
                logger.info(f"[AI] Attempting generate_city_briefing with model: {model}")
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model,
                    contents=prompt,
                    config={
                        "system_instruction": "You are a senior revenue management consultant focusing on actionable, concise market intelligence."
                    },
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                logger.warning(f"[AI] Model {model} failed in generate_city_briefing: {e}")
                last_error = e
                continue
                
        logger.error(f"[AI] All models failed for city briefing: {last_error}")
        return f"# {city_data.get('city', 'Market')} Briefing\n\nError synthesizing briefing text due to service interruption."

    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generates a vector embedding for the given text.
        """
        if not self.sdk_available or not self.client:
            return None

        models_to_try = [
            ("models/gemini-embedding-2", 768),
            ("models/text-embedding-004", 768)
        ]
        
        last_error = None
        for model_name, dims in models_to_try:
            try:
                result = self.client.models.embed_content(
                    model=model_name,
                    contents=text,
                    config={
                        "task_type": "RETRIEVAL_DOCUMENT",
                        "output_dimensionality": dims,
                    }
                )
                if result and result.embeddings and len(result.embeddings) > 0:
                    return result.embeddings[0].values
            except Exception as e:
                logger.warning(f"[AI] Embedding model {model_name} failed: {e}")
                last_error = e
                continue
                
        logger.error(f"[AI] Embedding failed for all models: {last_error}")
        return None


# Singleton instance
intelligence_service = MarketIntelligenceService()
