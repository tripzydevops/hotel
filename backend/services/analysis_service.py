"""
Analysis Service
Handles complex market analysis, room type matching, and sentiment data processing.
"""

# LINTER FIX: Moved imports to top of file to resolve E402
import json
from typing import Any, Dict, List, Optional, cast

from backend.utils.helpers import convert_currency
from backend.utils.vendor_normalizer import normalize_vendor_name
from backend.utils.logger import get_logger
from supabase import Client

# AGENT_LOGIC: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

# AGENT_NOTE: Added typing-safe import for Google GenAI to satisfy strict linter checks

try:
    from google.genai import types
except ImportError:
    pass



from backend.services.analysis_core import (
    get_price_for_room,
    generate_synthetic_narrative,
    calculate_rate_recommendation,
    generate_audit_checklist,
)
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
                            "is_historical": False,
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
                            daily_snapshot_map[date_key]["is_historical"] = p_log.get(
                                "is_historical", False
                            )
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
                "is_historical": snap.get("is_historical", False),
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

    sentiment_breakdown = target_h.get("sentiment_breakdown") or [] if target_h else []
    if isinstance(sentiment_breakdown, str):
        try:
            sentiment_breakdown = json.loads(sentiment_breakdown)
        except Exception:
            sentiment_breakdown = []

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
        "sentiment_index": float(int(sent_val * 10) / 10.0),
        "sentiment_breakdown": sentiment_breakdown,
        "target_rating": target_sentiment,
        "market_rating": avg_sent_val,
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
    query_db = admin_db if admin_db else db
    rates = {}
    try:
        from backend.utils.helpers import _EXCHANGE_RATE_CACHE
        rates = _EXCHANGE_RATE_CACHE
    except ImportError:
        pass

    logger.info(f"[Analysis] Calling database RPC get_market_analysis_aggregates for user_id={user_id}")
    
    try:
        res = query_db.rpc("get_market_analysis_aggregates", {
            "p_user_id": str(user_id),
            "p_room_type": room_type,
            "p_display_currency": currency if currency else display_currency,
            "p_start_date": start_date,
            "p_end_date": end_date,
            "p_exchange_rates": rates,
            "p_exclude_hotel_ids": exclude_hotel_ids,
            "p_search_query": search_query
        }).execute()
        
        data = res.data
    except Exception as e:
        logger.error(f"[Analysis] RPC failed: {e}")
        data = None

    if not data or not isinstance(data, dict):
        logger.warning(
            f"[Analysis] Empty or invalid RPC response for user_id {user_id}."
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
            "recommendation": {"action": "no_data", "impact": 0, "reason": "No data found."},
            "synthetic_narrative": "No data found.",
            "audit_checklist": [],
        }

    # Python post-processing (recommendation, synthetic narrative, audit checklist, legacy compatibility aliases)
    ari = data.get("ari")
    sent_index = data.get("sentiment_index") or data.get("sent_index")
    target_price = data.get("target_price")
    pricing_dna = data.get("pricing_dna")
    hotel_name = data.get("hotel_name") or "Target"
    market_avg_scores = data.get("market_avg_scores") or {}

    # recommendation
    rec = calculate_rate_recommendation(ari, sent_index, target_price)

    # synthetic_narrative
    narrative = generate_synthetic_narrative(ari, sent_index, pricing_dna, hotel_name)

    # audit_checklist
    target_h = {
        "sentiment_breakdown": data.get("sentiment_breakdown"),
        "pricing_dna": pricing_dna
    }
    checklist = generate_audit_checklist(target_h, market_avg_scores)

    # Attach calculated fields and aliases for backward/forward compatibility
    data["recommendation"] = rec
    data["synthetic_narrative"] = narrative
    data["audit_checklist"] = checklist
    data["hotels"] = data.get("all_hotels", [])
    data["transformed_hotels"] = data.get("all_hotels", [])
    data["sentiment_index"] = sent_index
    data["sent_index"] = sent_index

    return data


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
