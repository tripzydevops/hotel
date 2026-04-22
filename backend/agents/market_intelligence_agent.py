from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timezone

from backend.services.analysis_service import (
    generate_strategy_embedding,
    run_market_intelligence,
    synthesize_pricing_dna,
)
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class MarketIntelligenceAgent:
    """
    AI Orchestrator using Gemini 3 (gemini-3-flash-preview).
    Now acts as a thin wrapper delegating to AnalysisService for core logic.
    """

    def __init__(self, model: str = "gemini-3-flash-preview"):
        self.model = model

    async def run_analysis(
        self,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        volatility: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Runs the Gemini 3 agentic reasoning flow over current scan results.
        Delegates to AnalysisService.run_market_intelligence.
        """
        return await run_market_intelligence(
            scraper_results=scraper_results,
            threshold=threshold,
            volatility=volatility,
            model=self.model,
        )

    async def analyze_market_batch(
        self, insforge: Any, analysis_payload: List[Dict[str, Any]]
    ) -> bool:
        """
        High-level orchestration for batch market analysis.
        Generates analysis and persists a report.
        """
        if not analysis_payload:
            return False

        try:
            logger.info(
                f"MarketIntelligenceAgent: Triggering analysis for {len(analysis_payload)} results..."
            )
            intelligence = await self.run_analysis(analysis_payload)

            report_title = f"System Market Briefing - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            hotel_ids = [str(r.get("hotel_id")) for r in analysis_payload if r.get("hotel_id")]

            insforge.table("reports").insert(
                {
                    "id": str(uuid.uuid4()),
                    "title": report_title,
                    "report_type": "briefing",
                    "hotel_ids": hotel_ids,
                    "report_data": intelligence,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ).execute()

            logger.info(f"MarketIntelligenceAgent: Successfully saved Briefing: {report_title}")
            return True
        except Exception as e:
            logger.error(f"MarketIntelligenceAgent: Batch analysis failed: {e}")
            return False

    async def synthesize_pricing_dna(
        self, history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Synthesizes a hotel's 'Pricing DNA' from historical performance logs.
        Delegates to AnalysisService.synthesize_pricing_dna.
        """
        return await synthesize_pricing_dna(history=history, model=self.model)

    async def generate_strategy_embedding(
        self, dna: Dict[str, Any]
    ) -> Optional[List[float]]:
        """
        Converts the Pricing DNA narrative into a vector embedding.
        Delegates to AnalysisService.generate_strategy_embedding.
        """
        return await generate_strategy_embedding(dna=dna)
