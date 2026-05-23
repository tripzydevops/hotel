"""
Analysis Service
Handles complex market analysis, room type matching, and sentiment data processing.
"""

import asyncio
import os
import re
# LINTER FIX: Moved imports to top of file to resolve E402
import json
import time
from typing import Any, Dict, List, Optional, Tuple, cast

from backend.services.ai_service import intelligence_service
from backend.utils.helpers import convert_currency
from backend.utils.vendor_normalizer import normalize_vendor_name
from backend.utils.logger import get_logger
from backend.utils.sentiment_utils import (
    calculate_stability,
)
from supabase import Client

# AGENT_LOGIC: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

# AGENT_NOTE: Added typing-safe import for Google GenAI to satisfy strict linter checks
from backend.utils.ai_client import get_genai_client, HAS_GENAI

try:
    from google.genai import types
except ImportError:
    pass


async def get_sentiment_trends(
    db: Client, hotel_id: str, limit: int = 10
) -> Dict[str, Any]:
    # AGENT_FEATURE: Sentiment Trend Engine
    # Analyzes historical sentiment data to determine momentum and stability.
    try:
        res = (
            db.table("sentiment_history")
            .select("rating, recorded_at")
            .eq("hotel_id", hotel_id)
            .order("recorded_at", desc=True)
            .limit(limit)
            .execute()
        )

        history = res.data or []
        if not history or len(history) < 2:
            return {"momentum": 0.0, "stability": 1.0, "trend": "stable", "history": []}

        ratings = [float(h["rating"]) for h in history]
        ratings.reverse()  # Oldest to newest

        # Momentum: Change between start and end of window
        calc_momentum: float = float(ratings[-1] - ratings[0]) if ratings else 0.0
        # Use explicit shadowing for linter type narrowing
        momentum: float = 0.0
        # AGENT_FIX: Corrected indentation for manual math
        momentum = float(int(float(calc_momentum) * 100) / 100.0)

        # Stability: Standard deviation (using utility)
        volatility: float = calculate_stability(ratings)
        raw_stability: float = float(max(0.0, 1.0 - volatility))
        stability: float = 1.0  # 1.0 is perfectly stable
        if isinstance(raw_stability, (int, float)):
            # AGENT_FIX: Manual truncation for stability
            stability = float(int(float(raw_stability) * 100) / 100.0)

        trend = "stable"
        if momentum >= 0.2:
            trend = "improving"
        elif momentum <= -0.2:
            trend = "declining"

        if volatility > 0.4:
            trend = f"volatile_{trend}"

        return {
            "momentum": momentum,
            "stability": stability,
            "trend": trend,
            "recent_rating": ratings[-1],
            "history": ratings,
        }
    except Exception as e:
        logger.error(f"[Trends] Failed to fetch sentiment trends: {e}")
        return {"momentum": 0.0, "stability": 1.0, "trend": "unknown", "history": []}


def _transform_serp_links(breakdown: Any) -> Any:
    """
    Transforms raw SerpApi JSON links into user-friendly Google Travel URLs.
    """
    if not isinstance(breakdown, list):
        return breakdown

    for item in breakdown:
        if isinstance(item, dict) and "link" in item:
            link = item["link"]
            if "google.com/search" in link and "ludocid" in link:
                try:
                    params = dict(re.findall(r"(\w+)=([^&]+)", link))
                    token = params.get("kp") or params.get("ludocid")
                    if token:
                        item["link"] = (
                            f"https://www.google.com/travel/hotels/entity/{token}/reviews"
                        )
                except Exception:
                    pass
    return breakdown


def _extract_price(raw: Any, currency: Optional[str] = None) -> Optional[float]:
    """Helper to cleanly extract a numeric price from various raw formats (str, int, float)."""
    if raw is None:
        return None
    try:
        if isinstance(raw, (float, int)):
            return float(raw)

        s = str(raw).strip()
        # Remove everything except digits, dots, commas
        s_clean = re.sub(r"[^\d.,]", "", s)
        if not s_clean:
            return None

        # Strip any leading/trailing dots or commas
        s_clean = s_clean.strip(".,")
        if not s_clean:
            return None

        curr_upper = (currency or "").upper()

        # Count separators
        dots = s_clean.count(".")
        commas = s_clean.count(",")

        # Case 1: Both exist (e.g. "3.825,00" or "3,825.00" or "1.500.000,25")
        if dots > 0 and commas > 0:
            last_dot = s_clean.rfind(".")
            last_comma = s_clean.rfind(",")
            if last_comma > last_dot:
                # Comma is decimal separator. Remove all dots.
                s_clean = s_clean.replace(".", "").replace(",", ".")
            else:
                # Dot is decimal separator. Remove all commas.
                s_clean = s_clean.replace(",", "")

        # Case 2: Only dots exist
        elif dots > 0:
            if dots > 1:
                # Multiple dots -> all are thousand separators (e.g. 1.500.000)
                s_clean = s_clean.replace(".", "")
            else:
                # Exactly one dot. Check trailing digits.
                idx = s_clean.find(".")
                trailing = len(s_clean) - idx - 1
                if trailing == 3:
                    # Ambiguity! E.g. "1.234"
                    # In hotel price contexts, a single separator + 3 digits is almost ALWAYS
                    # a thousand separator, as rates like $1.234 or 1.234 TRY are extremely unlikely
                    # to be decimals. We resolve it as thousand for consistency.
                    s_clean = s_clean.replace(".", "")
                else:
                    # e.g. "120.5" or "120.50" -> treat as decimal
                    pass

        # Case 3: Only commas exist
        elif commas > 0:
            if commas > 1:
                # Multiple commas -> all are thousand separators
                s_clean = s_clean.replace(",", "")
            else:
                # Exactly one comma.
                idx = s_clean.find(",")
                trailing = len(s_clean) - idx - 1
                if trailing == 3:
                    # E.g. "1,234" -> thousand separator
                    s_clean = s_clean.replace(",", "")
                else:
                    # E.g. "120,50" -> treat as decimal
                    s_clean = s_clean.replace(",", ".")

        return float(s_clean)
    except Exception:
        pass
    return None



def get_price_for_room(
    price_log: Dict[str, Any],
    target_room_type: str,
    allowed_room_names_map: Dict[str, List[str]],
    currency: Optional[str] = None,
) -> Tuple[Optional[float], Optional[str], float]:
    """
    Finds the best matching room price within a price log.
    STRICT SOURCE ROUTING:
    - Standard -> Lead Price (top-level 'price') is the primary source.
    - Deluxe/Suite -> 'room_types' array is the ONLY source.
    """
    if not price_log:
        return None, None, 0.0

    t_lower = target_room_type.lower().strip()
    r_types = price_log.get("room_types") or []
    
    # Use currency from price_log if not explicitly provided
    active_currency = currency or price_log.get("currency")

    # 1. OPTIMIZED MATCHING: EXACT NAME FIRST
    # If the user selected a specific room name from the dropdown, find it exactly.
    if isinstance(r_types, list) and target_room_type:
        for r in r_types:
            if not isinstance(r, dict):
                continue
            r_name = (r.get("name") or "").strip().lower()
            if r_name == t_lower:
                p = _extract_price(r.get("price"), currency=active_currency)
                if p is not None and p > 0:
                    return p, r.get("name"), 1.0

    # 2. CATEGORY DETECTION (Fallback to Keywords)
    # Synchronizing with frontend's roomNormalization.ts logic
    standard_keys = [
        "standard",
        "standart",
        "economy",
        "ekonomik",
        "promo",
        "base",
        "classic",
        "klasik",
        "double",
        "twin",
        "single",
        "tek",
        "çift",
    ]
    is_standard = any(s in t_lower for s in standard_keys) or not target_room_type
    is_suite = any(s in t_lower for s in ["suite", "süit"])
    is_deluxe = any(s in t_lower for s in ["deluxe", "superior", "premium", "corner"])

    # 3. HANDLE STANDARD CATEGORY
    if is_standard and not is_suite and not is_deluxe:
        # Lead price is the most reliable "from" price for Standard in the market logs
        lead_p = _extract_price(price_log.get("price"), currency=active_currency)
        if lead_p is not None and lead_p > 0:
            return lead_p, "Standard (Main)", 1.0

        # Fallback within category if lead price is null
        if isinstance(r_types, list) and r_types:
            valid_prices = []
            for r in r_types:
                if not isinstance(r, dict):
                    continue
                r_name = (r.get("name") or "").lower()
                # Must match standard keys OR be a safe generic name
                if any(k in r_name for k in standard_keys) or not any(
                    k in r_name
                    for k in ["suite", "süit", "deluxe", "superior", "premium"]
                ):
                    p = _extract_price(r.get("price"), currency=active_currency)
                    if p:
                        valid_prices.append((p, r.get("name") or "Standard"))
            if valid_prices:
                valid_prices.sort(key=lambda x: x[0])
                return valid_prices[0][0], valid_prices[0][1], 0.8
        return None, None, 0.0

    # 4. HANDLE PREMIUM CATEGORIES (Deluxe, Suite)
    if not isinstance(r_types, list) or not r_types:
        # LEGACY FALLBACK: If no room_types array exists, use the top-level lead price
        # as a baseline even for non-standard room requests. This ensures historical
        # continuity for logs (e.g. Jan/Feb) that lacked granular room mapping.
        lead_p = _extract_price(price_log.get("price"), currency=active_currency)
        if lead_p is not None and lead_p > 0:
            return lead_p, "Legacy Fallback", 0.5
        return None, None, 0.0

    matches = []
    for r in r_types:
        if not isinstance(r, dict):
            continue
        r_name = (r.get("name") or "").lower()
        p = _extract_price(r.get("price"), currency=active_currency)
        if not p:
            continue

        # Strict keyword matching per category
        if is_suite and any(
            k in r_name for k in ["suite", "süit", "presidential", "kral"]
        ):
            matches.append((p, r.get("name"), 0.9))
        elif is_deluxe and any(
            k in r_name for k in ["deluxe", "superior", "premium", "corner"]
        ):
            # Verification: Ensure it's not actually a 'Standard' room with some weird name
            if (
                any(s in r_name for s in ["standard", "standart"])
                and "deluxe" not in r_name
            ):
                continue
            matches.append((p, r.get("name"), 0.9))

    if matches:
        # Pick the most representative (lowest) price for the selected category
        matches.sort(key=lambda x: x[0])
        return matches[0][0], matches[0][1], matches[0][2]

    # No match found for requested room or its category
    return None, None, 0.0


def generate_synthetic_narrative(
    ari: Optional[float],
    sent_index: Optional[float],
    dna_text: Optional[str],
    hotel_name: str,
) -> str:
    """
    Generates a high-level strategic verdict based on pricing (ARI) and sentiment.
    """
    if ari is None or sent_index is None:
        missing = []
        if ari is None:
            missing.append("Average Rate Index")
        if sent_index is None:
            missing.append("Sentiment Index")
        return (
            f"Note: Some market benchmarks ({', '.join(missing)}) are currently unavailable. "
            "Broadening your tracking list may improve this insight."
        )

    f_ari: float = float(ari) if ari is not None else 100.0
    f_sent: float = float(sent_index) if sent_index is not None else 100.0
    price_status = (
        "premium" if f_ari >= 105 else "aligned" if f_ari >= 95 else "aggressive"
    )
    sent_status = (
        "superior" if f_sent >= 105 else "standard" if f_sent >= 95 else "at-risk"
    )
    dna_blurb = f" Guided by your '{dna_text}' strategy," if dna_text else ""

    if price_status == "premium" and sent_status == "superior":
        return f"[Commercial Health]\n{hotel_name} is a 'Premium King'. {dna_blurb} you are justifying higher rates through superior experience."
    elif price_status == "aligned" and sent_status == "standard":
        return f"[Operational Baseline]\n{hotel_name} is at 'Market Baseline'. {dna_blurb} rates and satisfaction are aligned with competitors."
    elif price_status == "aggressive" and sent_status == "superior":
        return f"[Commercial Health]\nGrowth Potential Detected. {dna_blurb} guests love you despite aggressive pricing. Capture more value."
    elif price_status == "premium" and sent_status == "at-risk":
        return f"[Commercial Health]\nDanger Zone. {dna_blurb} your rates are high but sentiment is falling. Audit operations immediately."
    elif price_status == "aggressive" and sent_status == "at-risk":
        return f"[Commercial Health]\nBudget Volume Cycle. {dna_blurb} competing on price alone is risky. Churn risk is high."

    return f"[Commercial Health]\n{hotel_name} is market-aligned. ARI: {ari:.1f}, SentIndex: {sent_index:.1f}."


# genai_client is retrieved from centralized get_genai_client()


def _clean_json_output(raw_text: str) -> str:
    """Cleans markdown JSON fencing from LLM output."""
    if "```json" in raw_text:
        return raw_text.split("```json")[1].split("```")[0].strip()
    elif "```" in raw_text:
        return raw_text.split("```")[1].split("```")[0].strip()
    return raw_text.strip()


async def run_market_intelligence(
    scraper_results: List[Dict[str, Any]],
    threshold: float = 2.0,
    volatility: float = 0.0,
    model: str = "gemini-3-flash-preview",
) -> Dict[str, Any]:
    """
    Core AI logic for market anomaly detection and strategic reasoning.
    Uses Gemini 3 agentic reasoning traces.
    """
    # 1. Prepare data summary
    summary = []
    for res in scraper_results:
        if res.get("status") == "success":
            pd = cast(Dict[str, Any], res.get("price_data") or {})
            reviews_list = cast(List[Dict[str, Any]], pd.get("reviews", []))
            summary.append(
                {
                    "hotel_id": res.get("hotel_id"),
                    "hotel_name": res.get("hotel_name", "Unknown"),
                    "current_price": pd.get("price"),
                    "prev_price": pd.get("previous_price"),
                    "reviews": reviews_list[0:3],
                }
            )

    if not summary:
        return {
            "reasoning": [],
            "final_report": "No valid data to analyze.",
            "agentic": False,
        }

    client = get_genai_client()
    if not client:
        return run_heuristic_market_fallback(summary, threshold, volatility)

    try:
        prompt = f"""
        You are a Senior Hotel Revenue Architect. Analyze this market dataset and provide strategic reasoning.
        
        GOALS:
        1. Identify price anomalies (> {threshold}%).
        2. Identify the 'Behavioral Rival': Which tracked hotel has the highest correlation or most aggressive reaction to the primary hotel's price shifts?
        3. Acknowledge VOLATILITY: Mention if we are using a 'Smart Threshold' to suppress noise.
        4. Extract pricing power signals from guest sentiment.
        
        DATA: {summary}
        VOLATILITY: {volatility}% (Threshold Adjusted: {threshold}%)
        
        REQUIRED JSON STRUCTURE:
        {{
          "reasoning_trace": [{{"step": "str", "message": "str", "level": "info/warning/error"}}],
          "behavioral_rival": {{"name": "str", "reason": "str"}},
          "final_report": "CONCISE SUMMARY WITH ALL CAPS HEADERS"
        }}
        """

        response = await asyncio.to_thread(
            client.models.generate_content, model=model, contents=prompt
        )

        if not response or not response.text:
            raise ValueError("No output from Gemini generate_content")

        raw_data = json.loads(_clean_json_output(response.text))

        trace = raw_data.get("reasoning_trace", [])
        now = time.time()
        for i, item in enumerate(trace):
            item["level"] = item.get("level", "info")
            item["timestamp"] = now + (i * 0.1)

        return {
            "reasoning": trace,
            "behavioral_rival": raw_data.get("behavioral_rival"),
            "final_report": raw_data.get("final_report", ""),
            "agentic": True,
        }

    except Exception as e:
        logger.error(f"[AI] Market Intelligence Error: {e}")
        return run_heuristic_market_fallback(summary, threshold, volatility)


def run_heuristic_market_fallback(
    summary: List[Dict[str, Any]], threshold: float, volatility: float
) -> Dict[str, Any]:
    """Fallback logic for market intelligence."""
    now = time.time()
    reasoning = [
        {
            "step": "Market Intel",
            "level": "info",
            "message": f"Heuristic fallback: Scanning {len(summary)} properties (Volatility: {volatility}%).",
            "timestamp": now,
        }
    ]

    for idx, s in enumerate(summary):
        try:
            cp = float(s.get("current_price") or 0.0)
            pp = float(s.get("prev_price") or 0.0)
        except (ValueError, TypeError):
            continue

        if pp > 0:
            change = abs((cp - pp) / pp) * 100
            if change > threshold:
                reasoning.append(
                    {
                        "step": "Anomaly Detection",
                        "level": "warning",
                        "message": f"Breach for {s['hotel_name']}: {change:.1f}% change exceeds {threshold}% threshold.",
                        "timestamp": now + (idx + 1) * 0.1,
                    }
                )

    return {
        "reasoning": reasoning,
        "final_report": "Heuristic analysis complete. No major strategic shifts detected beyond direct price alerts.",
        "agentic": False,
    }


async def synthesize_pricing_dna(
    history: List[Dict[str, Any]], model: str = "gemini-3-flash-preview"
) -> Dict[str, Any]:
    """
    Synthesizes a hotel's 'Pricing DNA' from historical performance logs.
    """
    client = get_genai_client()
    if not client:
        return {"strategy": "Default", "last_updated": None}

    prompt = f"""
    You are a Strategic Revenue Architect. Analyze the following 30-day history for a hotel and define its 'Pricing DNA'.
    
    DATA: {history}
    
    GOALS:
    1. Identify the 'Strategy Archetype' (e.g. Volume Leader, Yield Seeker, Benchmark Follower).
    2. Determine 'Pricing Elasticity' based on sentiment vs price shifts.
    3. Define a 'Strategic Narrative' (2 sentences).
    
    OUTPUT JSON:
    {{
      "archetype": "str",
      "narrative": "str",
      "volatility_tolerance": "high/medium/low",
      "competitive_posture": "aggressive/neutral/passive",
      "dna_version": "1.0"
    }}
    """

    try:
        response = await asyncio.to_thread(
            client.models.generate_content, model=model, contents=prompt
        )
        dna = json.loads(_clean_json_output(response.text))
        dna["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return dna
    except Exception as e:
        logger.error(f"[AI] DNA Synthesis Error: {e}")
        return {"strategy": "Error", "error": str(e)}


async def generate_strategy_embedding(dna: Dict[str, Any]) -> Optional[List[float]]:
    """
    Converts the Pricing DNA narrative into a vector embedding for retrieval grounding.
    """
    narrative = dna.get("narrative", "")
    archetype = dna.get("archetype", "")
    text_to_embed = f"Hotel Strategy: {archetype}. Perspective: {narrative}"

    return await intelligence_service.get_embedding(text_to_embed)


async def stream_narrative_gen(
    target_hotel_name: str,
    analysis_results: Dict[str, Any],
    locale: str = "en",
    admin_db: Optional[Client] = None,
):
    """
    Step 2: Generate the Gemini 3 narrative using the interactions streaming API.
    """
    # Defensive values to avoid lint errors/crashes
    ari = analysis_results.get("ari", 100.0)
    sent_index = analysis_results.get("sent_index", 100.0)
    dna_text = analysis_results.get("pricing_dna", "Neutral strategy.")
    hotel_name = target_hotel_name

    language = "Turkish" if locale == "tr" else "English"
    prompt = f"""
    Act as a senior hotel revenue analyst. Analyze the following market position for '{target_hotel_name}':
    - Target Price: {analysis_results.get("target_price")}
    - Market Average: {analysis_results.get("market_average")}
    - Competitor Count: {len(analysis_results.get("transformed_hotels", []))}
    - Advisory Signals: {", ".join(analysis_results.get("advisory_keys", []))}
    
    Current Sentiment Index: {sent_index}
    Price Index (ARI): {ari}
    Strategy DNA: {dna_text}

    INSTRUCTIONS:
    - Write a concise, professional summary in {language}.
    - Focus on strategic positioning and yield recommendations.
    - DO NOT use markdown formatting (no asterisks, no headers).
    """

    try:
        client = get_genai_client()
        if not client:
            yield generate_synthetic_narrative(
                ari, sent_index, dna_text, str(hotel_name or "Unknown")
            )
            return

        # AGENT_FEATURE: Using modern Interactions API with streaming and Gemini 3.1
        stream = client.interactions.create(
            model="gemini-3-flash-preview",
            input=prompt,
            generation_config={"temperature": 0.7},
            stream=True
        )
        for chunk in stream:
            if chunk.event_type == "content.delta":
                if chunk.delta.type == "text":
                    yield chunk.delta.text
                    await asyncio.sleep(0.01)  # Throttling for smoother UI flow

    except Exception as e:
        logger.error(f"[SSE] AI Narrative failed: {e}")
        yield generate_synthetic_narrative(
            ari, sent_index, dna_text, str(hotel_name or "Unknown")
        )


def calculate_rate_recommendation(
    ari: Optional[float], sent_index: Optional[float], current_price: Optional[float]
) -> dict:
    if not ari or not sent_index or not current_price:
        return {"action": "no_data", "impact": 0, "reason": "Insufficient benchmarks."}

    f_ari: float = float(ari) if ari is not None else 0.0
    f_sent: float = float(sent_index) if sent_index is not None else 0.0
    curr_p: float = float(current_price) if current_price is not None else 0.0

    if f_sent >= 105 and f_ari < 95:
        return {
            "action": "increase",
            "impact": 5.0,
            "reason": f"Strong brand strength. Target {curr_p * 1.05:.0f} rate.",
        }
    if f_ari >= 105 and f_sent < 95:
        return {
            "action": "decrease",
            "impact": -5.0,
            "reason": f"Overpriced for sentiment. Correct to {curr_p * 0.95:.0f}.",
        }
    if f_ari < 85:
        return {
            "action": "maintain",
            "impact": 0,
            "reason": "Aggressive discounting - watch profitability.",
        }

    return {"action": "maintain", "impact": 0, "reason": "Aligned with market."}


def generate_audit_checklist(target_h: dict, market_avg_scores: dict) -> list:
    checklist = []
    if not target_h or not market_avg_scores:
        return checklist

    # AGENT_FIX: Updated pillars to match actual DB sentiment categories
    # The database uses positive/total counts instead of a direct rating.
    pillars = ["Cleanliness", "Service", "Value", "Room", "Location"]
    bd = target_h.get("sentiment_breakdown") or []

    my_scores = {}
    for item in bd:
        name = item.get("name", "").lower()
        total = item.get("total", 0)
        if total > 0:
            # Normalize to 5-point scale for comparison with market averages
            rating = (item.get("positive", 0) / total) * 5.0
            my_scores[name] = rating

    for p in pillars:
        p_lower = p.lower()
        my_s = my_scores.get(p_lower, 0.0)
        # Use 4.0 as a safe fallback if market average for a pillar is missing
        mkt_s = market_avg_scores.get(p, 4.0)

        if my_s > 0 and my_s < mkt_s * 0.95:
            checklist.append(
                {
                    "pillar": p,
                    "issue": f"{p} is below market average ({my_s:.1f} vs {mkt_s:.1f}).",
                    "action": f"Task: {p} quality audit.",
                }
            )

    if not checklist:
        checklist.append(
            {"pillar": "Global", "issue": "Performing well.", "action": "Maintain."}
        )
    # AGENT_FIX: cast(Any, ...) is required here because the IDE's linter environment
    # incorrectly assumes list.__getitem__ only supports integer indices, not slices.
    return cast(Any, checklist)[:3]


