"""
Revenue Impact from Sentiment Service (Feature 7.2)
Quantifies the financial cost of sentiment score changes.
"Your cleanliness score dropped 0.4 pts over 30 days → estimated ₺8,200/month revenue loss"
"""

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict

from supabase import Client

logger = logging.getLogger(__name__)

# Conservative revenue-sensitivity assumptions (industry benchmarks)
# Each 0.1 star drop in review score = ~0.8-1.2% RevPAR decline (Cornell CREF study)
# 1.0 review point = 10% RevPAR impact
REVPAR_SENSITIVITY_PER_POINT = 10.0   # percentage points of RevPAR change per 1.0 review point
ASSUMED_ROOMS = 60                     # fallback if hotel doesn't have room count
ASSUMED_OCCUPANCY = 0.68              # 68% average occupancy (Turkey midscale)
ASSUMED_ADR = 1200.0                  # ₺1200 ADR fallback


async def calculate_sentiment_revenue_impact(
    db: Client, hotel_id: str
) -> Dict[str, Any]:
    """
    Compares sentiment scores from 30 days ago vs today and estimates
    the monthly revenue impact of the change.
    """
    try:
        hotel_res = db.table("hotels").select("name").eq("id", hotel_id).single().execute()
        # .single() returns a dict in real Supabase; handle list fallback defensively
        raw = hotel_res.data
        if isinstance(raw, list):
            hotel_name = raw[0].get("name", "Your Hotel") if raw else "Your Hotel"
        else:
            hotel_name = (raw or {}).get("name", "Your Hotel")

        # Fetch sentiment history
        cutoff_recent = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        cutoff_past = (datetime.now(timezone.utc) - timedelta(days=37)).isoformat()
        cutoff_past_end = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

        recent_res = (
            db.table("sentiment_history")
            .select("rating, recorded_at")
            .eq("hotel_id", hotel_id)
            .gte("recorded_at", cutoff_recent)
            .order("recorded_at", desc=True)
            .limit(10)
            .execute()
        )

        past_res = (
            db.table("sentiment_history")
            .select("rating, recorded_at")
            .eq("hotel_id", hotel_id)
            .gte("recorded_at", cutoff_past)
            .lte("recorded_at", cutoff_past_end)
            .order("recorded_at", desc=True)
            .limit(10)
            .execute()
        )

        recent_ratings = [r["rating"] for r in (recent_res.data or []) if r.get("rating")]
        past_ratings = [r["rating"] for r in (past_res.data or []) if r.get("rating")]

        if not recent_ratings or not past_ratings:
            return _no_data_result(hotel_name)

        recent_avg = sum(recent_ratings) / len(recent_ratings)
        past_avg = sum(past_ratings) / len(past_ratings)
        delta = recent_avg - past_avg   # positive = improvement, negative = decline

        # Estimate revenue impact
        # RevPAR sensitivity: each 1.0 point = REVPAR_SENSITIVITY_PER_POINT% change
        revpar_change_pct = delta * REVPAR_SENSITIVITY_PER_POINT
        monthly_revenue_base = ASSUMED_ROOMS * ASSUMED_OCCUPANCY * ASSUMED_ADR * 30
        monthly_impact = monthly_revenue_base * (revpar_change_pct / 100)

        direction = "improvement" if delta > 0 else "decline"
        impact_sign = "+" if monthly_impact >= 0 else ""

        # Generate AI narrative
        narrative = await _generate_narrative(
            hotel_name=hotel_name,
            delta=delta,
            recent_avg=recent_avg,
            past_avg=past_avg,
            monthly_impact=monthly_impact,
        )

        return {
            "hotel_id": hotel_id,
            "hotel_name": hotel_name,
            "recent_score": round(recent_avg, 2),
            "past_score": round(past_avg, 2),
            "score_delta": round(delta, 2),
            "direction": direction,
            "estimated_monthly_impact_try": round(monthly_impact, 0),
            "impact_formatted": f"{impact_sign}₺{abs(monthly_impact):,.0f}/month",
            "revpar_change_pct": round(revpar_change_pct, 2),
            "narrative": narrative,
            "methodology": (
                "Estimate based on Cornell CREF benchmark: "
                "1.0 review point ≈ 10% RevPAR change. "
                f"Assumed {ASSUMED_ROOMS} rooms, {ASSUMED_OCCUPANCY*100:.0f}% occupancy, "
                f"₺{ASSUMED_ADR:,.0f} ADR."
            ),
            "data_points": {
                "recent_period": f"Last 7 days ({len(recent_ratings)} data points)",
                "past_period": f"30-37 days ago ({len(past_ratings)} data points)",
            },
        }

    except Exception as e:
        logger.error(f"Revenue impact calculation failed for hotel {hotel_id}: {e}")
        return {"error": str(e), "narrative": "Impact calculation unavailable."}


async def _generate_narrative(
    hotel_name: str,
    delta: float,
    recent_avg: float,
    past_avg: float,
    monthly_impact: float,
) -> str:
    """Uses Gemini to generate a concise, human-readable revenue impact narrative."""
    try:
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return _static_narrative(hotel_name, delta, monthly_impact)

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-3.1-pro-preview")

        direction_word = "improved" if delta > 0 else "dropped"
        impact_sign = "+" if monthly_impact >= 0 else ""

        prompt = f"""
Write a single, concise sentence (max 30 words) explaining the revenue impact
of a sentiment score change for a hotel revenue manager. Be specific and urgent.

Hotel: {hotel_name}
Score {direction_word}: {abs(delta):.1f} points (from {past_avg:.1f} to {recent_avg:.1f})
Estimated monthly impact: {impact_sign}₺{abs(monthly_impact):,.0f}

Do not use markdown. Write only the sentence.
"""
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return _static_narrative(hotel_name, delta, monthly_impact)


def _static_narrative(hotel_name: str, delta: float, monthly_impact: float) -> str:
    direction = "improved" if delta > 0 else "dropped"
    impact_sign = "+" if monthly_impact >= 0 else "-"
    return (
        f"{hotel_name}'s review score {direction} by {abs(delta):.1f} points, "
        f"estimated monthly revenue impact: {impact_sign}₺{abs(monthly_impact):,.0f}."
    )


def _no_data_result(hotel_name: str) -> Dict[str, Any]:
    return {
        "hotel_name": hotel_name,
        "recent_score": None,
        "past_score": None,
        "score_delta": 0,
        "direction": "unchanged",
        "estimated_monthly_impact_try": 0,
        "impact_formatted": "Insufficient data",
        "narrative": (
            f"Not enough sentiment history for {hotel_name} to estimate revenue impact. "
            "Collect at least 2 weeks of review scores to enable this feature."
        ),
    }
