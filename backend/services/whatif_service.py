"""
What-If Scenario Modeling Service
Allows hoteliers to ask "What happens if I raise my rate by X%?"
and receive an AI-generated market impact simulation.
"""

import json
import logging
import os
from typing import Any, Dict

from supabase import Client

logger = logging.getLogger(__name__)


async def simulate_whatif_scenario(
    db: Client,
    user_id: str,
    hotel_id: str,
    scenario: str,
    stream: bool = False,
) -> Dict[str, Any]:
    """
    Runs a What-If scenario simulation using Gemini with real market context.

    Example scenarios:
    - "What if I raise my Standard Room price by €25?"
    - "What if I offer a 10% early-bird discount for 30+ day advance bookings?"
    - "What if my main competitor drops rates by 20% next week?"

    Returns a structured simulation result with:
    - predicted_occupancy_impact: percentage change estimate
    - predicted_revenue_impact: estimated monthly revenue delta
    - competitor_reactions: list of likely competitor responses
    - risk_level: Low / Medium / High
    - recommendation: AI strategic recommendation
    - reasoning: step-by-step logic trace
    """
    # 1. Gather market context
    context = await _gather_market_context(db, user_id, hotel_id)
    if not context:
        return _fallback_result("Unable to fetch market context for simulation.")

    # 2. Build prompt
    prompt = _build_prompt(scenario, context)

    # 3. Call Gemini
    try:
        import google.generativeai as genai

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return _fallback_result("GEMINI_API_KEY not configured.")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-3.1-pro-preview")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            ),
        )
        result = json.loads(response.text)
        result["scenario"] = scenario
        result["context_snapshot"] = {
            "target_price": context.get("target_price"),
            "market_avg": context.get("market_avg"),
            "competitor_count": len(context.get("competitors", [])),
        }
        return result

    except Exception as e:
        logger.error(f"What-If simulation failed: {e}")
        return _fallback_result(str(e))


async def _gather_market_context(
    db: Client, user_id: str, hotel_id: str
) -> Dict[str, Any]:
    """Fetches the minimum viable market context needed for a simulation."""
    try:
        from datetime import datetime, timezone, timedelta

        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

        # Target hotel price
        target_res = (
            db.table("price_logs")
            .select("price, currency")
            .eq("hotel_id", hotel_id)
            .order("recorded_at", desc=True)
            .limit(1)
            .execute()
        )
        target_price = target_res.data[0]["price"] if target_res.data else 0
        currency = target_res.data[0]["currency"] if target_res.data else "TRY"

        # Hotel name
        hotel_res = (
            db.table("hotels").select("name, location, star_rating").eq("id", hotel_id).single().execute()
        )
        hotel_data = hotel_res.data or {}

        # Competitor prices
        comp_res = (
            db.table("user_hotels")
            .select("hotel_id, hotels(name)")
            .eq("user_id", user_id)
            .neq("hotel_id", hotel_id)
            .execute()
        )
        competitor_ids = [r["hotel_id"] for r in (comp_res.data or []) if r.get("hotel_id")]

        competitors = []
        if competitor_ids:
            cp_res = (
                db.table("price_logs")
                .select("hotel_id, price")
                .in_("hotel_id", competitor_ids)
                .gte("recorded_at", cutoff)
                .order("recorded_at", desc=True)
                .execute()
            )
            seen: set = set()
            for row in (cp_res.data or []):
                if row["hotel_id"] not in seen and row["price"] and row["price"] > 0:
                    seen.add(row["hotel_id"])
                    name = next(
                        (r.get("hotels", {}).get("name") for r in comp_res.data if r["hotel_id"] == row["hotel_id"]),
                        "Competitor"
                    )
                    competitors.append({"name": name, "price": row["price"]})

        market_avg = (
            sum(c["price"] for c in competitors) / len(competitors)
            if competitors else target_price
        )

        return {
            "hotel_name": hotel_data.get("name", "Your Hotel"),
            "location": hotel_data.get("location", ""),
            "star_rating": hotel_data.get("star_rating", 3),
            "target_price": target_price,
            "currency": currency,
            "market_avg": round(market_avg, 2),
            "competitors": competitors[:5],
        }

    except Exception as e:
        logger.error(f"Market context fetch failed: {e}")
        return {}


def _build_prompt(scenario: str, context: Dict) -> str:
    return f"""
You are a senior hotel revenue management consultant with deep expertise in market pricing dynamics.

A revenue manager at {context.get('hotel_name')} in {context.get('location')} 
({context.get('star_rating', 3)}-star hotel) wants to simulate the following scenario:

"{scenario}"

Current Market Context:
- Their current rate: {context.get('currency')} {context.get('target_price')}
- Market average: {context.get('currency')} {context.get('market_avg')}
- Active competitors: {json.dumps(context.get('competitors', []))}

Simulate the likely market impact of this scenario. Be specific, data-driven, and realistic.
Consider competitor reactions, occupancy sensitivity, and seasonal factors.

Return ONLY valid JSON with this exact structure:
{{
  "predicted_occupancy_impact": "e.g. -3% to -7% occupancy drop",
  "predicted_revenue_impact": "e.g. +₺12,000/month net positive",
  "competitor_reactions": ["e.g. Hilton may match within 72h", "Budget hotels unlikely to react"],
  "risk_level": "Low|Medium|High",
  "recommendation": "One sentence strategic recommendation",
  "reasoning": "Step-by-step explanation of the simulation logic"
}}
"""


def _fallback_result(reason: str) -> Dict[str, Any]:
    return {
        "predicted_occupancy_impact": "Unable to simulate",
        "predicted_revenue_impact": "Unable to simulate",
        "competitor_reactions": [],
        "risk_level": "Unknown",
        "recommendation": "Please try again or check your market data.",
        "reasoning": f"Simulation unavailable: {reason}",
        "error": True,
    }
