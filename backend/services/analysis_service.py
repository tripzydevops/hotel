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
try:
    from google import genai
    from google.genai import types

    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


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
        # Remove currency symbols and whitespace
        s_clean = re.sub(r"[^\d.,]", "", s)
        if not s_clean:
            return None

        # Normalize currency for lookup
        curr_upper = (currency or "").upper()

        # Case 1: Both . and , exist (e.g. "3.825,00" or "3,825.00")
        if "." in s_clean and "," in s_clean:
            if s_clean.rfind(",") > s_clean.rfind("."):
                # Turkish/European: Dot is thousand, Comma is decimal
                s_clean = s_clean.replace(".", "").replace(",", ".")
            else:
                # US/UK: Comma is thousand, Dot is decimal
                s_clean = s_clean.replace(",", "")

        # Case 2: Only Dot or Comma exists (e.g. "3.825" or "150,50")
        else:
            # Find all separators
            separators = [m.start() for m in re.finditer(r"[.,]", s_clean)]
            if separators:
                last_sep_idx = separators[-1]
                last_sep_char = s_clean[last_sep_idx]
                trailing_digits = len(s_clean) - last_sep_idx - 1
                
                # AMBIGUITY FIX: exactly 3 trailing digits (e.g. 1.234)
                if trailing_digits == 3:
                    # In USD/GBP/EUR, a dot followed by 3 digits is almost ALWAYS a decimal (e.g. 1.000)
                    # or an accidental 3-digit decimal from a scraper.
                    # Thousand separators in these currencies are usually commas.
                    if last_sep_char == "." and curr_upper in ["USD", "GBP", "EUR", "CAD", "AUD"]:
                        # Treat as decimal
                        s_clean = s_clean.replace(",", ".")
                    elif last_sep_char == "," and curr_upper == "TRY":
                        # In TR, comma is decimal.
                        s_clean = s_clean.replace(",", ".")
                    else:
                        # Default to thousand separator for 3-digits if it's the only separator
                        # This handles "1.234" in TR or "1,234" in US correctly.
                        s_clean = s_clean.replace(".", "").replace(",", "")
                else:
                    # Assume it's a decimal separator (e.g., "150.50" or "150,50")
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
        return None, None, 0.0

    matches = []
    for r in r_types:
        if not isinstance(r, dict):
            continue
        r_name = (r.get("name") or "").lower()
        p = _extract_price(r.get("price"), currency=currency)
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


_genai_client = None


def get_genai_client():
    global _genai_client
    if _genai_client is None:
        if not HAS_GENAI:
            logger.warning("[AI] google-genai SDK missing. Falling back to heuristics.")
            return None
        try:
            api_key = os.getenv("GOOGLE_API_KEY")
            if api_key:
                # AGENT_FEATURE: Using modern genai.Client (google-genai SDK)
                _genai_client = genai.Client(api_key=api_key)
            else:
                logger.warning("[AI] GOOGLE_API_KEY not found in environment.")
        except Exception as e:
            logger.error(f"[AI] Failed to initialize Google GenAI Client: {e}")
    return _genai_client


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


async def perform_market_analysis(
    user_id: str,
    hotels: List[Dict[str, Any]],
    hotel_prices_map: Dict[str, List[Dict[str, Any]]],
    display_currency: str,
    room_type: str,
    start_date: Optional[str],
    end_date: Optional[str],
    allowed_room_names_map: Dict[str, List[str]],
    locale: str = "en",
) -> Dict[str, Any]:
    # Initialize core stats early to avoid UnboundLocalError
    market_average = 0.0
    market_min = 0.0
    market_max = 0.0
    current_prices: List[float] = []
    market_sentiments: List[float] = []
    target_hotel_id: Optional[str] = None
    target_hotel_name: str = "Unknown"
    target_sentiment: float = 0.0
    target_price: Optional[float] = None
    target_history = []
    price_rank_list = []

    # Find Target
    for h in hotels:
        r_val = h.get("rating")
        if r_val is not None:
            market_sentiments.append(float(r_val))
        if h.get("is_target_hotel") and not target_hotel_id:
            target_hotel_id = str(h["id"])
            target_hotel_name = h.get("name", "Target")
            target_sentiment = float(r_val or 0.0)

    if not target_hotel_id and hotels:
        target_hotel_id = str(hotels[0]["id"])
        target_hotel_name = hotels[0].get("name", "Fallback")
        target_sentiment = float(hotels[0].get("rating") or 0.0)

    # Market Stats
    raw_ratings = [float(h.get("rating")) for h in hotels if h.get("rating") is not None]
    avg_sent_val = sum(raw_ratings) / len(raw_ratings) if raw_ratings else 0.0

    # AGENT_FIX: Calculate Market Sentiment Averages for Audit Checklist
    market_avg_scores = {}
    pillar_data: Dict[str, List[float]] = {}
    for h in hotels:
        h_bd = h.get("sentiment_breakdown") or []
        for item in h_bd:
            name = item.get("name")
            if not name:
                continue
            # Normalize to capitalized for consistent lookup (e.g., "Service")
            name_norm = name.capitalize()
            total = item.get("total", 0)
            if total > 0:
                rating = (item.get("positive", 0) / total) * 5.0
                if name_norm not in pillar_data:
                    pillar_data[name_norm] = []
                pillar_data[name_norm].append(rating)

    for name, ratings in pillar_data.items():
        market_avg_scores[name] = sum(ratings) / len(ratings)

    # Build Price Rank
    for h in hotels:
        hid = str(h["id"])
        is_target = hid == target_hotel_id
        prices_for_h = hotel_prices_map.get(hid, [])
        if prices_for_h:
            p_log = prices_for_h[0]
            lead_cur = p_log.get("currency") or "USD"
            price_val, match_name, match_score = get_price_for_room(
                p_log, room_type, allowed_room_names_map
            )
            if price_val is not None and price_val > 0:
                conv = convert_currency(price_val, lead_cur, display_currency)
                if conv > 0:
                    current_prices.append(conv)
                    price_rank_list.append(
                        {
                            "id": hid,
                            "name": h.get("name"),
                            "price": conv,
                            "rank": 0,
                            "is_target": is_target,
                            "rating": h.get("rating"),
                            "review_count": h.get("review_count"),
                            "matched_room_name": match_name,
                            "match_score": match_score,
                            "offers": p_log.get("parity_offers") or [],
                        }
                    )
                    if is_target:
                        target_price = conv
    # AGENT_FIX: Comprehensive Pivot for Daily Prices (Rate Spread Chart)
    # Using explicit typing to assist IDE inference
    daily_snapshot_map: Dict[str, Dict[str, Any]] = {}

    for h in hotels:
        hid = str(h["id"])
        is_target = hid == target_hotel_id
        p_logs = hotel_prices_map.get(hid, [])

        # Limit to last 100 logs for better historical/stay coverage
        logs_slice: List[Dict[str, Any]] = cast(List[Dict[str, Any]], p_logs)[:100]

        for p_log in logs_slice:
            # AGENT_FEATURE: Prioritize check_in_date for actual stay-based analysis
            # Current dashboard 'Rate Spread' expects stay dates, not scan times.
            raw_date = p_log.get("check_in_date") or p_log.get("recorded_at")
            if not raw_date or not isinstance(raw_date, str):
                continue

            # AGENT_FIX: Strict date cleaning to avoid "Invalid Date" in frontend
            clean_date = raw_date.strip()
            if not clean_date:
                continue

            # Attempt to extract YYYY-MM-DD
            try:
                # Handle ISO "T" separator or space separator
                date_key = (
                    clean_date.split("T")[0]
                    if "T" in clean_date
                    else clean_date.split(" ")[0]
                )
                # Validate length and format (YYYY-MM-DD)
                if len(date_key) != 10 or "-" not in date_key:
                    continue
            except Exception:
                continue

            p_val, _, _ = get_price_for_room(p_log, room_type, allowed_room_names_map)
            if p_val is not None and float(p_val) > 0:
                conv_p = convert_currency(
                    float(p_val), p_log.get("currency") or "USD", display_currency
                )

                if conv_p > 0:
                    if date_key not in daily_snapshot_map:
                        daily_snapshot_map[date_key] = {
                            "date": date_key,
                            "check_out_date": p_log.get("check_out_date"),
                            "target_price": 0.0,
                            "target_intraday_events": [],
                            "comp_prices_map": {},  # Map hid -> comp price object for easy updates
                            "seen_ids": set(),
                        }

                # AGENT_FEATURE: Intraday Event Collection & Detection
                # We compare with the previous scan for the same stay date to detect shifts.
                prev_price = None
                # Logs are sorted desc by recorded_at, so the 'next' log in the loop
                # is actually the 'previous' chronological scan.
                # Find the next log for the SAME check_in_date
                current_index = logs_slice.index(p_log)
                for next_log in logs_slice[current_index + 1 :]:
                    if next_log.get("check_in_date") == p_log.get("check_in_date"):
                        p_v, _, _ = get_price_for_room(
                            next_log, room_type, allowed_room_names_map
                        )
                        if p_v:
                            prev_price = convert_currency(
                                float(p_v),
                                next_log.get("currency") or "USD",
                                display_currency,
                            )
                        break

                label = "Price Scan"
                if locale == "tr":
                    label = "Fiyat Taraması"

                if prev_price and prev_price > 0:
                    diff_pct = (conv_p - prev_price) / prev_price
                    if diff_pct <= -0.10:
                        label = "Flash Sale"
                        if locale == "tr":
                            label = "Flaş İndirim"
                    elif diff_pct >= 0.15:
                        label = "Rate Spike"
                        if locale == "tr":
                            label = "Fiyat Artışı"

                event = {
                    "price": float(conv_p),
                    "recorded_at": p_log.get("recorded_at"),
                    "vendor": normalize_vendor_name(p_log.get("vendor") or "Direct"),
                    "label": label,
                }

                if is_target:
                    daily_snapshot_map[date_key]["target_intraday_events"].append(event)
                    # Use the first one found (latest) as the primary price
                    if hid not in daily_snapshot_map[date_key]["seen_ids"]:
                        daily_snapshot_map[date_key]["target_price"] = float(conv_p)
                else:
                    if hid not in daily_snapshot_map[date_key]["comp_prices_map"]:
                        daily_snapshot_map[date_key]["comp_prices_map"][hid] = {
                            "name": h.get("name", "Competitor"),
                            "price": float(conv_p),
                            "intraday_events": [],
                        }
                    daily_snapshot_map[date_key]["comp_prices_map"][hid][
                        "intraday_events"
                    ].append(event)

                daily_snapshot_map[date_key]["seen_ids"].add(hid)

    # Convert map to ordered list for frontend (asc order for timeline)
    daily_prices: List[Dict[str, Any]] = []
    sorted_dates = sorted(daily_snapshot_map.keys())
    for d_key in sorted_dates:
        snap = daily_snapshot_map[d_key]
        tp: float = float(snap.get("target_price") or 0.0)

        # Convert comp_prices_map back to a list
        c_details: List[Dict[str, Any]] = list(snap.get("comp_prices_map", {}).values())
        c_vals = [float(cp["price"]) for cp in c_details]

        # Calculate daily market average
        d_avg = sum(c_vals) / len(c_vals) if c_vals else 0.0

        # AGENT_FIX: Strict Room Type Display
        # If user is looking at a Premium room type (Suite, Deluxe etc.), we
        # must NOT fall back to market average if target hotel is sold out.
        # Standard requests still use the market average fallback to keep the line consistent.
        t_low = (room_type or "").lower()
        is_premium = any(
            k in t_low
            for k in [
                "suite",
                "süit",
                "deluxe",
                "superior",
                "premium",
                "family",
                "aile",
            ]
        )

        final_price = tp
        if tp <= 0 and not is_premium:
            final_price = d_avg

        daily_prices.append(
            {
                "date": snap["date"],
                "check_out_date": snap.get("check_out_date"),
                "price": final_price,
                "comp_avg": d_avg,
                "vs_comp": float(int(((final_price - d_avg) / d_avg * 100) * 10) / 10.0)
                if final_price > 0 and d_avg > 0
                else 0.0,
                "competitors": c_details,
                "intraday_events": snap.get("target_intraday_events", []),
            }
        )

    # target_history is used for the trend card (desc order usually)
    target_history = sorted(
        [{"price": d["price"], "recorded_at": d["date"]} for d in daily_prices],
        key=lambda x: str(x["recorded_at"]),
        reverse=True,
    )

    if daily_prices:
        logger.info(
            f"[Analysis] daily_prices range: {daily_prices[0]['date']} to {daily_prices[-1]['date']} (count: {len(daily_prices)})"
        )
    else:
        logger.info("[Analysis] daily_prices is EMPTY")

    price_rank_list.sort(key=lambda x: x["price"])
    for i, item in enumerate(price_rank_list):
        item["rank"] = i + 1

    market_average = (
        sum(current_prices) / len(current_prices) if current_prices else 0.0
    )
    market_min = min(current_prices) if current_prices else 0.0
    market_max = max(current_prices) if current_prices else 0.0

    # Finding min/max hotel objects for tooltips
    min_h_obj = next(
        (h for h in price_rank_list if h["price"] == market_min), {"name": "N/A"}
    )
    max_h_obj = next(
        (h for h in price_rank_list if h["price"] == market_max), {"name": "N/A"}
    )

    # AGENT_FEATURE: Collect all available room types in the market logs for the dropdown
    # We scan more than just the first log to ensure stability of the dropdown options.
    # AGENT_FEATURE: Always include core categories to ensure they are selectable in the UI
    all_room_names = {"Standard", "Deluxe", "Suite"}
    for p_logs in hotel_prices_map.values():
        # Scan up to 30 recent logs for each hotel to capture all room types they've recently offered
        recent_logs = cast(List[Dict[str, Any]], p_logs)[:30]
        for p_log in recent_logs:
            rt_list = p_log.get("room_types") or []
            for rt in rt_list:
                if isinstance(rt, dict) and rt.get("name"):
                    name = rt["name"].strip()
                    if name:
                        all_room_names.add(name)

    # AGENT_FEATURE: Pre-map hotels to the frontend's interface
    transformed_hotels = [
        {
            "id": str(h["id"]),
            "name": h.get("name", "Unknown"),
            "is_target": str(h["id"]) == target_hotel_id,
        }
        for h in hotels
    ]

    # Ranking
    comp_rank = next((h["rank"] for h in price_rank_list if h["is_target"]), 1)

    ari = (
        (target_price / market_average) * 100
        if target_price and market_average > 0
        else None
    )
    sent_index = (
        (target_sentiment / avg_sent_val) * 100
        if target_sentiment and avg_sent_val > 0
        else None
    )

    # Advisory logic mapping to localized keys in the frontend
    advisory_keys = []
    if ari and ari < 90:
        advisory_keys.append("underpriced")
    if ari and ari > 110:
        advisory_keys.append("overpriced")
    if sent_index and sent_index > 105:
        advisory_keys.append("strong_sentiment")

    # AGENT_FIX: Type stability for final return
    ari_val: float = float(ari or 100.0)
    sent_val: float = float(sent_index or 100.0)

    # Advisory Labels for the quadrant
    q_label = "Neutral"
    if ari is None or sent_index is None:
        q_label = "Insufficient Data"
    else:
        if ari_val >= 100.0 and sent_val >= 100.0:
            q_label = "Premium King"
        elif ari_val < 100.0 and sent_val >= 100.0:
            q_label = "Value Leader"
        elif ari_val >= 100.0 and sent_val < 100.0:
            q_label = "Danger Zone"
        else:
            q_label = "Economy"

    # Find the target hotel object for narrative context
    target_h = next((h for h in hotels if str(h["id"]) == target_hotel_id), None)

    # Building a consistent response object that follows the KAİZEN frontend contract
    return {
        "hotel_id": target_hotel_id,
        "hotel_name": target_hotel_name,
        "market_average": float(int(market_average * 100) / 100.0)
        if market_average > 0
        else 0.0,
        "market_avg": float(int(market_average * 100) / 100.0)
        if market_average > 0
        else 0.0,  # Legacy alias
        "target_price": float(int(target_price * 100) / 100.0)
        if target_price is not None
        else None,
        "market_min": market_min,
        "market_max": market_max,
        "min_hotel": {"name": min_h_obj.get("name"), "price": market_min},
        "max_hotel": {"name": max_h_obj.get("name"), "price": market_max},
        "all_hotels": transformed_hotels,  # Cleaned for AnalysisFilters
        "competitors": [h for h in transformed_hotels if not h["is_target"]],
        "total_hotels": len(hotels),
        "total_competitors": len(hotels) - 1 if len(hotels) > 0 else 0,
        "available_room_types": sorted(list(all_room_names)),
        "competitive_rank": comp_rank,
        "market_rank": comp_rank,
        "ari": float(int(ari_val * 10) / 10.0),
        "sent_index": float(int(sent_val * 10) / 10.0),
        "quadrant_label": q_label,
        "quadrant_x": ari_val,
        "quadrant_y": sent_val,
        "price_rank_list": price_rank_list,
        "price_history": target_history,
        "daily_prices": daily_prices,  # Pivoted market-wide data
        "recommendation": calculate_rate_recommendation(ari, sent_index, target_price),
        "advisory_keys": advisory_keys,
        "synthetic_narrative": generate_synthetic_narrative(
            ari_val,
            sent_val,
            target_h.get("pricing_dna") if target_h else None,
            target_hotel_name,
        ),
        "audit_checklist": generate_audit_checklist(target_h, market_avg_scores)
        if target_h
        else [],
    }


async def get_market_intelligence_data(
    db: Client,
    user_id: str,
    room_type: str = "Standard",
    display_currency: str = "TRY",
    currency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exclude_hotel_ids: Optional[str] = None,
    search_query: Optional[str] = None,
    admin_db: Optional[Client] = None,
) -> Dict[str, Any]:
    # AGENT_FEATURE: Analysis Service now utilizes admin_db to bypass RLS for faster intelligence
    query_db = admin_db if admin_db else db
    # AGENT_LOGIC: Many-to-Many Migration (Kaizen 2026)
    # Replaced 1:N query (hotels.user_id) with Many-to-Many join via user_hotels table.
    # This allows multiple users to track/share the same hotel entities.
    logger.info(f"[Analysis] Mapping hotels via user_hotels for userId: {user_id}")

    # AGENT_FIX: Using join table to fetch shared hotel entities with user-specific overrides
    user_hotels_res = (
        query_db.table("user_hotels")
        .select("*, hotels(*)")
        .eq("user_id", str(user_id))
        .execute()
    )

    all_hotels = []
    for mapping in user_hotels_res.data or []:
        hotel = mapping.get("hotels")
        if hotel:
            # Inject user-specific overrides from user_hotels mapping table
            # These override the global defaults in the 'hotels' table
            hotel["is_target_hotel"] = mapping.get("is_target", False)
            hotel["pricing_dna"] = mapping.get("pricing_dna") or hotel.get(
                "pricing_dna"
            )
            hotel["preferred_currency"] = mapping.get("preferred_currency")
            hotel["fixed_check_in"] = mapping.get("fixed_check_in")
            hotel["fixed_check_out"] = mapping.get("fixed_check_out")
            hotel["default_adults"] = mapping.get("default_adults")
            hotel["user_id_override"] = mapping.get("user_id")  # For context if needed
            all_hotels.append(hotel)

    # No legacy fallback - user_id column removed from hotels table.
    # If no hotels found in user_hotels mappings, returning empty list is correct.

    hotels = [h for h in all_hotels if not h.get("deleted_at")]

    # AGENT_FEATURE: Apply exclude_hotel_ids filter
    if exclude_hotel_ids:
        to_exclude = set(exclude_hotel_ids.split(","))
        hotels = [h for h in hotels if str(h.get("id")) not in to_exclude]

    # AGENT_FEATURE: Apply search_query filter
    if search_query:
        sq = search_query.lower()
        hotels = [
            h
            for h in hotels
            if sq in str(h.get("name", "")).lower()
            or sq in str(h.get("location", "")).lower()
        ]

    logger.info(f"[Analysis] After filters: {len(hotels)} hotels remaining.")

    if not hotels:
        logger.warning(
            f"[Analysis] Zero hotels found for user_id {user_id}. Potential mapping issue."
        )
        return {
            "hotels": [],
            "all_hotels": [],
            "total_hotels": 0,
            "total_competitors": 0,
            "market_average": 0.0,
            "market_avg": 0.0,
            "market_min": 0.0,
            "market_max": 0.0,
            "target_price": 0.0,
            "ari": 100.0,
            "sent_index": 100.0,
            "quadrant_label": "No Data Found",
            "quadrant_x": 100.0,
            "quadrant_y": 100.0,
            "price_rank_list": [],
            "price_history": [],
            "daily_prices": [],
            "advisory_keys": [],
            "recommendation": f"DEBUG: user_id={user_id} | raw={len(hotels)} | check hotels_table mapping",
        }

    h_ids = [str(h["id"]) for h in hotels]
    # AGENT_LOGIC: Fetch only essential price log fields, avoiding large JSON blobs like amenities unless needed
    p_res = (
        query_db.table("price_logs")
        .select(
            "hotel_id,check_in_date,check_out_date,price,recorded_at,currency,room_types,vendor"
        )
        .in_("hotel_id", h_ids)
        .order("recorded_at", desc=True)
        .limit(1000)
        .execute()
    )
    logs = p_res.data or []

    p_map = {}
    # LINTER FIX: Renamed ambiguous variable 'l' to 'log' to resolve E741
    for log in logs:
        hid = str(log["hotel_id"])
        if hid not in p_map:
            p_map[hid] = []
        p_map[hid].append(log)

    # Building a more robust allowed_map with synonyms
    allowed_map = {}
    for h in hotels:
        # We start with the target room type
        synonyms = [room_type]
        rt_lower = room_type.lower()

        # Add broad defaults if we're looking for standard
        if "standard" in rt_lower or "standart" in rt_lower:
            synonyms.extend(
                [
                    "Standard Room",
                    "Standart Oda",
                    "Double Room",
                    "Twin Room",
                    "Deluxe Room",
                    "Economy Room",
                ]
            )
        elif "deluxe" in rt_lower:
            synonyms.extend(["Deluxe King", "Deluxe Twin", "Superior Room"])
        elif "suite" in rt_lower:
            synonyms.extend(
                ["Junior Suite", "Executive Suite", "King Suite", "Business Suite"]
            )

        allowed_map[str(h["id"])] = list(set(synonyms))

    return await perform_market_analysis(
        user_id=str(user_id),
        hotels=hotels,
        hotel_prices_map=p_map,
        display_currency=display_currency,
        room_type=room_type,
        start_date=start_date,
        end_date=end_date,
        allowed_room_names_map=allowed_map,
    )


async def check_hotel_ownership(
    db: Client, user_id: str, hotel_id: str, admin_bypass: bool = True
) -> bool:
    """
    Checks if a user owns a specific hotel via the user_hotels mapping table.
    """
    try:
        # 1. Admin Bypass
        if admin_bypass:
            profile_res = (
                db.table("user_profiles")
                .select("role")
                .eq("user_id", str(user_id))
                .maybe_single()
                .execute()
            )
            if profile_res.data and profile_res.data.get("role") in [
                "admin",
                "market_admin",
                "market admin",
            ]:
                return True

        # 2. Many-to-Many Mapping Check
        res = (
            db.table("user_hotels")
            .select("user_id")
            .eq("user_id", str(user_id))
            .eq("hotel_id", str(hotel_id))
            .execute()
        )
        return len(res.data or []) > 0
    except Exception as e:
        logger.error(f"Ownership check failed for hotel {hotel_id}: {e}")
        return False
