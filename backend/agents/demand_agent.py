from datetime import date, timedelta
from typing import Any, Dict, List

from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)


class DemandScoringAgent:
    """
    Aggregates localized demand signals (fairs, TGA events, aviation)
    to calculate a 'Market Compression Score' for specific dates and cities.
    """

    def __init__(self, db: Client):
        self.db = db

    async def calculate_compression(
        self, city: str, target_date: date
    ) -> Dict[str, Any]:
        """
        Calculates the compression score for a single date in a specific city.
        Algorithm: (Fair Score * Scale) + (TGA Promo Score * Intensity) + (Aviation Delta)
        """
        logger.info(
            f"[DemandScoringAgent] Calculating compression for {city} on {target_date}"
        )

        # 1. Fetch Events from Supabase
        events_res = (
            self.db.table("market_events")
            .select("*")
            .eq("city", city.capitalize())
            .lte("start_date", str(target_date))
            .gte("end_date", str(target_date))
            .execute()
        )
        events = events_res.data or []

        # 2. Base Scores
        fair_score = 0
        tga_score = 0
        signals = []

        for event in events:
            score = event.get("compression_score", 1)
            etype = event.get("type")

            if etype == "fair":
                fair_score += score
            elif etype == "announcement":
                tga_score += score

            signals.append({"name": event.get("name"), "type": etype, "score": score})

        # 3. Aviation Capacity Delta (Placeholder logic for Phase 2.1)
        # Note: In a real implementation, this would query a flight capacity table.
        aviation_delta = 0  # Future OAG/FlightAware integration

        # 4. Final aggregation
        # Scaling: Fairs have higher immediate impact on occupancy than announcements.
        total_score = (fair_score * 1.5) + (tga_score * 0.8) + aviation_delta

        # Normalize to 1-10 scale
        normalized_score = min(max(int(total_score), 1), 10)

        return {
            "city": city,
            "date": str(target_date),
            "compression_score": normalized_score,
            "signals": signals,
            "level": self._get_level(normalized_score),
        }

    def _get_level(self, score: int) -> str:
        if score >= 8:
            return "Critical (High Compression)"
        if score >= 6:
            return "Elevated (Moderate Compression)"
        if score >= 4:
            return "Active (Normal Demand)"
        return "Stable (Low Demand)"

    async def get_forecast(self, city: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Generates a multi-day demand forecast.
        """
        forecast = []
        today = date.today()

        for i in range(days):
            target_date = today + timedelta(days=i)
            score_data = await self.calculate_compression(city, target_date)
            forecast.append(score_data)

        return forecast
