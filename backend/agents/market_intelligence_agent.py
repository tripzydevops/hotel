from typing import List, Dict, Any, Optional
from backend.services.analysis_service import (
    run_market_intelligence, 
    synthesize_pricing_dna, 
    generate_strategy_embedding
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
        volatility: float = 0.0
    ) -> Dict[str, Any]:
        """
        Runs the Gemini 3 agentic reasoning flow over current scan results.
        Delegates to AnalysisService.run_market_intelligence.
        """
        return await run_market_intelligence(
            scraper_results=scraper_results,
            threshold=threshold,
            volatility=volatility,
            model=self.model
        )

    async def synthesize_pricing_dna(self, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Synthesizes a hotel's 'Pricing DNA' from historical performance logs.
        Delegates to AnalysisService.synthesize_pricing_dna.
        """
        return await synthesize_pricing_dna(history=history, model=self.model)

    async def generate_strategy_embedding(self, dna: Dict[str, Any]) -> Optional[List[float]]:
        """
        Converts the Pricing DNA narrative into a vector embedding.
        Delegates to AnalysisService.generate_strategy_embedding.
        """
        return await generate_strategy_embedding(dna=dna)
