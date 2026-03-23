"""
Analysis Service
Handles complex market analysis, room type matching, and sentiment data processing.
"""

import math
import re
from datetime import datetime, date, timedelta
import asyncio
import os
from typing import Optional, List, Dict, Any, Tuple, cast, Set
from supabase import Client
from backend.utils.helpers import convert_currency
from backend.utils.sentiment_utils import (
    normalize_sentiment,
    generate_mentions,
    translate_breakdown,
    synthesize_value_score,
    calculate_stability,
)
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)


async def get_sentiment_trends(
    db: Client, hotel_id: str, limit: int = 10
) -> Dict[str, Any]:
    """
    KAIZEN: Sentiment Trend Engine
    Analyzes historical sentiment data to determine momentum and stability.
    """
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
        calc_momentum: float = float(ratings[-1] - ratings[0])
        momentum = float(round(calc_momentum, 2)) if calc_momentum is not None else 0.0

        # Stability: Standard deviation (using utility)
        volatility: float = calculate_stability(ratings)
        raw_stability = float(max(0.0, 1.0 - volatility))
        stability: float = float(round(raw_stability, 2)) if raw_stability is not None else 1.0  # 1.0 is perfectly stable

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


def _extract_price(raw: Any) -> Optional[float]:
    """Helper to cleanly extract a numeric price from various raw formats (str, int, float)."""
    if raw is None:
        return None
    try:
        if isinstance(raw, (float, int)):
            return float(raw)

        s = str(raw).strip()
        # Remove currency symbols and whitespace
        s_clean = re.sub(r"[^\d.,]", "", s)

        # Case 1: Both . and , exist (e.g. "3.825,00" or "3,825.00")
        if "." in s_clean and "," in s_clean:
            if s_clean.rfind(",") > s_clean.rfind("."):
                # Turkish/European: Dot is thousand, Comma is decimal
                s_clean = s_clean.replace(".", "").replace(",", ".")
            else:
                # US/UK: Comma is thousand, Dot is decimal
                s_clean = s_clean.replace(",", "")

        # Case 2: Only Dot exists (e.g. "3.825" or "150.50")
        elif "." in s_clean:
            parts = s_clean.split(".")
            if len(parts) == 2 and len(parts[1]) == 3:
                val = float(s_clean)
                if val < 500:  # Threshold
                    s_clean = s_clean.replace(".", "")

        # Case 3: Only Comma exists (e.g. "125,50")
        elif "," in s_clean:
            # Assume comma is decimal (common in TR)
            s_clean = s_clean.replace(",", ".")

        return float(s_clean)
    except Exception:
        pass
    return None


def get_price_for_room(
    price_log: Dict[str, Any],
    target_room_type: str,
    allowed_room_names_map: Dict[str, List[str]],
) -> Tuple[Optional[float], Optional[str], float]:
    """
    Finds the best matching room price within a price log.
    """
    r_types = price_log.get("room_types") or []
    if not isinstance(r_types, list):
        return None, None, 0.0

    hid = str(price_log.get("hotel_id", ""))
    allowed_names = allowed_room_names_map.get(hid)

    if allowed_names:
        allowed_lower = {a.lower().strip() for a in allowed_names}
        for r in r_types:
            if isinstance(r, dict):
                r_name = r.get("name", "")
                if r_name.lower().strip() in allowed_lower:
                    t_lower = target_room_type.lower()
                    r_lower = r_name.lower()

                    is_standard_t = any(s in t_lower for s in ["standard", "standart"])
                    is_standard_r = any(s in r_lower for s in ["standard", "standart"])

                    # 1. Suite Guard
                    if "suite" in t_lower and not any(
                        k in r_lower for k in ["suite", "süit"]
                    ):
                        continue

                    # 2. Deluxe Guard
                    if (
                        any(k in t_lower for k in ["deluxe", "superior", "premium"])
                        and is_standard_r
                        and "deluxe" not in r_lower
                    ):
                        continue

                    # 3. Standard Leak Guard
                    if not is_standard_t and is_standard_r:
                        if not ("suite" in t_lower and "suite" in r_lower):
                            continue

                    return (
                        _extract_price(r.get("price")),
                        r_name,
                        0.82 + (0.1 * int(r_name == target_room_type)),
                    )

    target_variants = [target_room_type.lower()]
    if any(s in target_room_type.lower() for s in ["standard", "standart"]):
        target_variants.extend(["standard", "standart", "klasik", "classic", "ekonomik", "economy", "promo"])
    if "suite" in target_room_type.lower():
        target_variants.append("süit")
    if any(k in target_room_type.lower() for k in ["deluxe", "superior", "premium"]):
        target_variants.extend(["deluxe", "superior", "premium", "corner"])
    if any(k in target_room_type.lower() for k in ["family", "aile"]):
        target_variants.extend(["family", "aile", "connection", "connected", "bağlantılı"])

    for r in r_types:
        if not isinstance(r, dict):
            continue
        r_name = (r.get("name") or "").lower()
        c_name = (r.get("canonical_name") or "").lower()
        c_code = (r.get("canonical_code") or "").upper()

        if target_room_type.lower() in ["standard", "standart"] and c_code == "STD":
            return _extract_price(r.get("price")), r.get("name") or "Standard", 0.95

        if any(v in c_name for v in target_variants):
            if "suite" in target_room_type.lower() and not any(k in c_name for k in ["suite", "süit"]):
                continue
            return _extract_price(r.get("price")), r.get("name") or "Standard", 0.9

        if any(v in r_name for v in target_variants):
            t_low = target_room_type.lower()
            is_std_t = any(s in t_low for s in ["standard", "standart"])
            is_std_r = any(s in r_name for s in ["standard", "standart"])
            if "suite" in t_low and not any(k in r_name for k in ["suite", "süit"]):
                continue
            if not is_std_t and is_std_r and "deluxe" not in r_name and "superior" not in r_name:
                continue
            return _extract_price(r.get("price")), r.get("name") or "Standard", 0.85

    # FALLBACK
    target_low = target_room_type.lower().strip()
    is_premium = any(k in target_low for k in ["suite", "süit", "deluxe", "superior", "premium", "family", "aile", "balcony", "view"])
    is_base = not target_low or target_low == "oda" or any(v in target_low for v in ["standard", "standart", "base", "klasik", "classic", "eco", "promo"])
    is_standard_request = (is_base and not is_premium) or not target_room_type

    if is_standard_request and r_types:
        valid_prices = []
        for r in r_types:
            if not isinstance(r, dict): continue
            r_name = (r.get("name") or "").lower()
            if any(k in r_name for k in ["presidential", "başkanlık", "kral", "king suite", "queen suite", "balayı", "honeymoon", "dubleks", "duplex"]):
                continue
            p = _extract_price(r.get("price"))
            if p is not None:
                valid_prices.append((p, r.get("name") or "Standard (Min)"))
        if valid_prices:
            valid_prices.sort(key=lambda x: x[0])
            return valid_prices[0][0], valid_prices[0][1], 0.65

    if is_standard_request and not r_types:
        top_p = _extract_price(price_log.get("price"))
        if top_p is not None and top_p > 0:
            return top_p, "Standard (Legacy)", 0.7

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
        if ari is None: missing.append("Average Rate Index")
        if sent_index is None: missing.append("Sentiment Index")
        return (
            f"Note: Some market benchmarks ({', '.join(missing)}) are currently unavailable. "
            "Broadening your tracking list may improve this insight."
        )

    f_ari: float = float(ari) if ari is not None else 100.0
    f_sent: float = float(sent_index) if sent_index is not None else 100.0
    price_status = "premium" if f_ari >= 105 else "aligned" if f_ari >= 95 else "aggressive"
    sent_status = "superior" if f_sent >= 105 else "standard" if f_sent >= 95 else "at-risk"
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
        try:
            from google import genai
            api_key = os.getenv("GOOGLE_API_KEY")
            if api_key:
                _genai_client = genai.Client(api_key=api_key)
        except ImportError:
            logger.warning("[AI] google-genai SDK missing. Falling back to heuristics.")
    return _genai_client


async def stream_narrative_gen(analysis_data: Dict[str, Any], db: Client = None):
    """
    KAIZEN: Streaming Narrative Producer with restored structure.
    """
    hotel_name = analysis_data.get("hotel_name")
    hotel_id = analysis_data.get("hotel_id")
    ari = analysis_data.get("ari")
    sent_index = analysis_data.get("sent_index")
    dna_text = analysis_data.get("pricing_dna_text")
    q_label = analysis_data.get("quadrant_label")

    trends_blurb = ""
    if db and hotel_id:
        trends = await get_sentiment_trends(db, hotel_id)
        if trends["trend"] != "unknown":
            trends_blurb = f"\nHistorical Trends: {trends['trend']}, Momentum: {trends['momentum']}"

    prompt = f"You are a Senior Strategic Revenue Analyst for {hotel_name}. " \
             f"Price Index: {ari}, Sentiment Index: {sent_index}. Strategy: {dna_text}. {trends_blurb}. " \
             f"Generate 3 sections: MARKET DYNAMICS, STRATEGIC POSITIONING, ACTIONABLE RECOMMENDATIONS. Plain text only."

    try:
        client = get_genai_client()
        if not client:
            yield generate_synthetic_narrative(ari, sent_index, dna_text, str(hotel_name or "Unknown"))
            return

        response = client.models.generate_content_stream(model="gemini-3-flash-preview", contents=prompt)
        for chunk in response:
            if chunk and hasattr(chunk, "text") and chunk.text:
                yield chunk.text
                await asyncio.sleep(0.05)
    except Exception as e:
        logger.error(f"[SSE] AI Narrative failed: {e}")
        yield generate_synthetic_narrative(ari, sent_index, dna_text, str(hotel_name or "Unknown"))


def calculate_rate_recommendation(ari: Optional[float], sent_index: Optional[float], current_price: Optional[float]) -> dict:
    if not ari or not sent_index or not current_price:
        return {"action": "no_data", "impact": 0, "reason": "Insufficient benchmarks."}

    f_ari: float = float(ari) if ari is not None else 0.0
    f_sent: float = float(sent_index) if sent_index is not None else 0.0
    curr_p: float = float(current_price) if current_price is not None else 0.0

    if f_sent >= 105 and f_ari < 95:
        return {"action": "increase", "impact": 5.0, "reason": f"Strong brand strength. Target {curr_p * 1.05:.0f} rate."}
    if f_ari >= 105 and f_sent < 95:
        return {"action": "decrease", "impact": -5.0, "reason": f"Overpriced for sentiment. Correct to {curr_p * 0.95:.0f}."}
    if f_ari < 85:
        return {"action": "maintain", "impact": 0, "reason": "Aggressive discounting - watch profitability."}

    return {"action": "maintain", "impact": 0, "reason": "Aligned with market."}


def generate_audit_checklist(target_h: dict, market_avg_scores: dict) -> list:
    checklist = []
    if not target_h or not market_avg_scores: return checklist
    for p in ["Cleanliness", "Service", "Value"]:
        my_s = 0.0
        bd = target_h.get("sentiment_breakdown") or []
        for item in bd:
            if item.get("name", "").lower() == p.lower():
                my_s = float(item.get("rating") or 0.0)
                break
        mkt_s = market_avg_scores.get(p, 4.0)
        if my_s > 0 and my_s < mkt_s * 0.95:
            checklist.append({"pillar": p, "issue": f"{p} is below market.", "action": f"Task: {p} audit."})
    if not checklist: checklist.append({"pillar": "Global", "issue": "Performing well.", "action": "Maintain."})
    return checklist[:3]


async def perform_market_analysis(
    user_id: str,
    hotels: List[Dict[str, Any]],
    hotel_prices_map: Dict[str, List[Dict[str, Any]]],
    display_currency: str,
    room_type: str,
    start_date: Optional[str],
    end_date: Optional[str],
    allowed_room_names_map: Dict[str, List[str]],
) -> Dict[str, Any]:
    current_prices: List[float] = []
    market_sentiments: List[float] = []
    target_hotel_id: Optional[str] = None
    target_hotel_name: str = "Unknown"
    target_sentiment: float = 0.0
    target_price: Optional[float] = None
    target_history = []
    price_rank_list = []
    available_room_types = set()

    # Find Target
    for h in hotels:
        if h.get("rating"): market_sentiments.append(float(h["rating"]))
        if h.get("is_target_hotel") and not target_hotel_id:
            target_hotel_id = str(h["id"])
            target_hotel_name = h.get("name", "Target")
            target_sentiment = float(h.get("rating") or 0.0)
    
    if not target_hotel_id and hotels:
        target_hotel_id = str(hotels[0]["id"])
        target_hotel_name = hotels[0].get("name", "Fallback")
        target_sentiment = float(hotels[0].get("rating") or 0.0)

    # Market Stats
    raw_ratings = [float(h.get("rating") or 0.0) for h in hotels if h.get("rating")]
    avg_sent_val = sum(raw_ratings) / len(raw_ratings) if raw_ratings else 0.0

    # Build Price Rank
    for h in hotels:
        hid = str(h["id"])
        is_target = (hid == target_hotel_id)
        prices_for_h = hotel_prices_map.get(hid, [])
        if prices_for_h:
            p_log = prices_for_h[0]
            lead_cur = p_log.get("currency") or "USD"
            price_val, match_name, match_score = get_price_for_room(p_log, room_type, allowed_room_names_map)
            if price_val is not None:
                conv = convert_currency(price_val, lead_cur, display_currency)
                if conv > 0: current_prices.append(conv)
                price_rank_list.append({
                    "id": hid, "name": h.get("name"), "price": conv, "rank": 0, "is_target": is_target,
                    "rating": h.get("rating"), "review_count": h.get("review_count"),
                    "matched_room_name": match_name, "match_score": match_score
                })
                if is_target:
                    target_price = conv
                    for prev_p_log in prices_for_h[:30]:
                        pv, _, _ = get_price_for_room(prev_p_log, room_type, allowed_room_names_map)
                        if pv:
                            target_history.append({
                                "price": convert_currency(pv, prev_p_log.get("currency") or "USD", display_currency),
                                "recorded_at": prev_p_log.get("recorded_at")
                            })

    price_rank_list.sort(key=lambda x: x["price"])
    for i, item in enumerate(price_rank_list): item["rank"] = i+1

    market_avg = sum(current_prices) / len(current_prices) if current_prices else 0.0
    ari = (target_price / market_avg) * 100 if target_price and market_avg > 0 else None
    sent_index = (target_sentiment / avg_sent_val) * 100 if target_sentiment and avg_sent_val > 0 else None

    # Advisory
    q_label = "Neutral"
    if ari is None or sent_index is None: 
        q_label = "Insufficient Data"
    else:
        # Safe comparisons since ari and sent_index are guaranteed not None here
        if ari >= 100 and sent_index >= 100: q_label = "Premium King"
        elif ari < 100 and sent_index >= 100: q_label = "Value Leader"
        elif ari >= 100 and sent_index < 100: q_label = "Danger Zone"
        else: q_label = "Economy"

    target_h = next((h for h in hotels if str(h["id"]) == target_hotel_id), None)
    
    # [FIX] Enhanced Response Model for Frontend compatibility
    return {
        "hotel_id": target_hotel_id,
        "hotel_name": target_hotel_name,
        "market_avg": round(market_avg, 2) if market_avg > 0 else 0.0, 
        "target_price": round(target_price, 2) if target_price else 0.0,
        "total_hotels": len(hotels),
        "total_competitors": len(hotels) - 1 if len(hotels) > 0 else 0,
        "ari": round(ari, 1) if ari is not None else 100.0, 
        "sent_index": round(sent_index, 1) if sent_index is not None else 100.0,
        "quadrant_label": q_label,
        "price_rank_list": price_rank_list,
        "price_history": target_history,
        "recommendation": calculate_rate_recommendation(ari, sent_index, target_price),
        "synthetic_narrative": generate_synthetic_narrative(ari, sent_index, target_h.get("pricing_dna_text") if target_h else None, target_hotel_name)
    }


async def get_market_intelligence_data(
    db: Client, user_id: str, room_type: str = "Standard", display_currency: str = "TRY",
    start_date: Optional[str] = None, end_date: Optional[str] = None
) -> Dict[str, Any]:
    # [ROBUST] Programaatic filtering to avoid Supabase client version ambiguity with .is_("null")
    res = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    all_hotels = res.data or []
    hotels = [h for h in all_hotels if not h.get("deleted_at")]
    
    if not hotels: 
        return {
            "hotels": [], 
            "total_hotels": 0, 
            "total_competitors": 0, 
            "market_avg": 0.0, 
            "target_price": 0.0,
            "ari": 100.0,
            "sent_index": 100.0,
            "quadrant_label": "No Data",
            "price_rank_list": [],
            "price_history": [],
            "recommendation": "Add hotels to start monitoring market rates."
        }

    h_ids = [str(h["id"]) for h in hotels]
    p_res = db.table("price_logs").select("*").in_("hotel_id", h_ids).order("recorded_at", desc=True).limit(1000).execute()
    logs = p_res.data or []
    
    p_map = {}
    for l in logs:
        hid = str(l["hotel_id"])
        if hid not in p_map: p_map[hid] = []
        p_map[hid].append(l)

    allowed_map = {str(h["id"]): [room_type] for h in hotels}
    
    return await perform_market_analysis(
        user_id=str(user_id), hotels=hotels, hotel_prices_map=p_map,
        display_currency=display_currency, room_type=room_type,
        start_date=start_date, end_date=end_date, allowed_room_names_map=allowed_map
    )
