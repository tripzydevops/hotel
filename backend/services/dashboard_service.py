"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from types import SimpleNamespace
from fastapi import HTTPException
from supabase import Client

from backend.utils.logger import get_logger
from backend.services.price_comparator import price_comparator
from backend.utils.helpers import convert_currency
from backend.utils.sentiment_utils import (
    normalize_sentiment,
    generate_mentions,
    translate_breakdown,
    synthesize_value_score,
)
from backend.services.analysis_service import (
    generate_synthetic_narrative,
    calculate_rate_recommendation,
)

logger = get_logger(__name__)


async def get_dashboard_logic(
    user_id: str, current_user_id: str, current_user_email: str, db: Client
) -> Dict[str, Any]:
    """
    Main logic for assembling the dashboard data.
    Performes security checks, fetches hotel data, prices, and scan history.

    Optimized: Uses asyncio.gather for parallel database fetching.
    Bundled: Includes user profile and settings for "Fast Load" performance.
    """

    # 0. Core Fallback
    fallback_data: Dict[str, Any] = {
        "target_hotel": None,
        "competitors": [],
        "recent_searches": [],
        "scan_history": [],
        "recent_sessions": [],
        "unread_alerts_count": 0,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }

    if not db:
        logger.error("Dashboard: Database connection unavailable")
        fallback_data["error"] = "Database Unavailable"
        return fallback_data

    # 1. Security Check: Ownership or Admin
    is_authorized = str(current_user_id) == str(user_id)
    if not is_authorized:
        # Check if current user is admin
        profile_res = (
            db.table("user_profiles")
            .select("role")
            .eq("user_id", str(current_user_id))
            .limit(1)
            .execute()
        )
        if profile_res.data and profile_res.data[0].get("role") in [
            "admin",
            "market_admin",
            "market admin",
        ]:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=403, detail="Unauthorized access to this dashboard"
        )

    try:
        # [FIX] Sequential Data Fetching for Stability
        # Previous asyncio.to_thread + lambda approach was causing thread-safety crashes
        # with the Supabase client, leading to intermittent 500 errors on Vercel.
        
        # [FIX] Optimized Multi-Query Consolidation (Phase 8: Aggregate RPCs)
        try:
            rpc_res = await db.rpc("get_dashboard_init_data", {"p_user_id": str(user_id)}).execute()
            
            # Ensure we have a valid response object with data
            rpc_data = {}
            if hasattr(rpc_res, "data") and rpc_res.data:
                # PostgREST sometimes returns a single-row list for JSON-returning functions
                if isinstance(rpc_res.data, list) and len(rpc_res.data) > 0:
                    rpc_data = rpc_res.data[0]
                elif isinstance(rpc_res.data, dict):
                    rpc_data = rpc_res.data
                else:
                    logger.warning(f"Dashboard RPC: Unexpected data format: {type(rpc_res.data)}")

                # Always attempt to unwrap if the function name is a key (both list[0] and direct dict)
                if isinstance(rpc_data, dict) and "get_dashboard_init_data" in rpc_data:
                    rpc_data = rpc_data["get_dashboard_init_data"]
            
            if not rpc_data:
                logger.error(f"Dashboard RPC: No data returned for user {user_id}")
        except Exception as rpc_e:
            logger.error(f"Dashboard RPC: Error calling get_dashboard_init_data: {rpc_e}")
            rpc_data = {}

        user_profile = rpc_data.get("profile") or {}
        user_settings = rpc_data.get("settings") or {}
        unread_count = rpc_data.get("unread_alerts_count") or 0
        recent_searches_raw = rpc_data.get("recent_searches") or []
        recent_sessions = rpc_data.get("recent_sessions") or []
        all_hotels = rpc_data.get("hotels") or []
        core_profile_data = rpc_data.get("core_profile") or {}
        global_pulse = rpc_data.get("global_pulse") or []
        
        logger.info(f"Dashboard: Found {len(all_hotels)} hotels for user {user_id}")

        # [FIX] Scan History Query (Mapping via Hotel IDs)
        # We fetch the latest 10 logs across all the user's active hotels.
        scan_history = []
        if all_hotels:
            hids = [str(h["id"]) for h in all_hotels]
            hist_res = await (
                db.table("price_logs")
                .select("*")
                .in_("hotel_id", hids)
                .order("recorded_at", desc=True)
                .limit(10)
                .execute()
            )
            scan_history = hist_res.data or []

        # [KAIZEN] Resilient Fallback
        # If no hotels are found, we still return sessions, searches, and profile
        # to ensure the UI tiles don't look broken/desynchronized.
        if not all_hotels:
            logger.info(f"Dashboard: No hotels found for {user_id}, returning metadata only.")
            # [KAIZEN] Direct field assignment avoids typing.MutableMapping.update errors in strict linters
            fallback_data["profile"] = user_profile
            fallback_data["user_settings"] = user_settings
            fallback_data["unread_alerts_count"] = unread_count
            fallback_data["recent_searches"] = []
            fallback_data["recent_sessions"] = recent_sessions
            fallback_data["scan_history"] = []
            return fallback_data

        # 2. Enrich Hotels with Master Directory data & Batch Fetch Price Logs
        # We parallelize these two heavy data-layer operations
        serp_ids = list(
            set(h.get("serp_api_id") for h in all_hotels if h.get("serp_api_id"))
        )
        hotel_ids = [str(h["id"]) for h in all_hotels]

        dir_task = db.table("hotel_directory").select("*").in_("serp_api_id", serp_ids).execute() if serp_ids else asyncio.sleep(0, result=SimpleNamespace(data=[]))
        prices_task = db.table("price_logs").select("*").in_("hotel_id", hotel_ids).order("recorded_at", desc=True).limit(200).execute()

        dir_res, all_prices_res = await asyncio.gather(dir_task, prices_task, return_exceptions=True)

        directory_map = {}
        if not isinstance(dir_res, Exception) and hasattr(dir_res, "data") and dir_res.data:
            for drecord in dir_res.data:
                directory_map[drecord["serp_api_id"]] = drecord

        hotel_prices_map = {}
        if not isinstance(all_prices_res, Exception) and hasattr(all_prices_res, "data") and all_prices_res.data:
            for p in all_prices_res.data:
                hid = str(p["hotel_id"])
                if hid not in hotel_prices_map:
                    hotel_prices_map[hid] = []
                if len(hotel_prices_map[hid]) < 10:
                    hotel_prices_map[hid].append(p)

        # 4. Process Hotel Data
        enriched_hotels = []
        active_prices = []
        for h in all_hotels:
            hid = str(h["id"])
            token = h.get("property_token") or h.get("serp_api_id")
            if not token:
                continue

            dir_data = directory_map.get(h.get("serp_api_id"), {})
            prices = hotel_prices_map.get(hid, [])

            # Price Processing
            current_log = prices[0] if prices else None
            prev_log = prices[1] if len(prices) > 1 else None
            price_info = None
            if current_log and current_log.get("price") is not None:
                try:
                    curr_p = float(current_log["price"])
                    curr_c = current_log.get("currency") or "USD"
                    active_prices.append(curr_p)

                    prev_p = None
                    if prev_log and prev_log.get("price") is not None:
                        raw_prev = float(prev_log["price"])
                        prev_c = prev_log.get("currency") or "USD"
                        prev_p = convert_currency(raw_prev, prev_c, curr_c)

                    trend_obj, change = price_comparator.calculate_trend(curr_p, prev_p)
                    trend_val = str(getattr(trend_obj, "value", trend_obj))

                    price_info = {
                        "current_price": curr_p,
                        "previous_price": prev_p,
                        "currency": curr_c,
                        "trend": trend_val,
                        "change_percent": change,
                        "recorded_at": current_log.get("recorded_at"),
                        "vendor": current_log.get("vendor"),
                        "check_in": current_log.get("check_in_date"),
                        "offers": current_log.get("parity_offers") or [],
                        "room_types": current_log.get("room_types") or [],
                    }
                except Exception as e:
                    logger.warning(f"Price processing error: {e}")

            # Sentiment Processing
            # [FIX] Sentiment Fallback (Global Pulse)
            # If the user's specific hotel record is missing sentiment (e.g. newly re-added),
            # we try the global directory first, then fallback to ANY history share the same serp_api_id.
            raw_breakdown = h.get("sentiment_breakdown") or dir_data.get("sentiment_breakdown") or []
            
            if not raw_breakdown and h.get("serp_api_id"):
                sid = h["serp_api_id"]
                logger.info(f"[GlobalPulse/Dashboard] Recovering sentiment for {hid} (SERP: {sid})")
                try:
                    # Find ANY hotel IDs sharing this SERP ID
                    g_res = await db.table("hotels").select("id").eq("serp_api_id", sid).execute()
                    if g_res.data:
                        g_hids = [str(gh["id"]) for gh in g_res.data]
                        sh_res = await (
                            db.table("sentiment_history")
                            .select("sentiment_breakdown")
                            .in_("hotel_id", g_hids)
                            .order("recorded_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        if sh_res.data:
                            raw_breakdown = sh_res.data[0].get("sentiment_breakdown") or []
                            logger.info(f"[GlobalPulse/Dashboard] Recovered {len(raw_breakdown)} items for {sid}")
                except Exception as e:
                    logger.error(f"[GlobalPulse/Dashboard] Recovery failed for {sid}: {e}")
            item_sentiment = normalize_sentiment(raw_breakdown)

            # [FIX] Resilient Metadata Merging
            # Ensure static metadata (rating, reviews, stars) falls back to master directory
            # if the user's specific hotel record is incomplete.
            review_count = h.get("review_count") or dir_data.get("review_count")
            rating = h.get("rating") or dir_data.get("rating")
            stars = h.get("stars") or dir_data.get("stars")
            image_url = h.get("image_url") or dir_data.get("image_url")
            latitude = h.get("latitude") or dir_data.get("latitude")
            longitude = h.get("longitude") or dir_data.get("longitude")
            amenities = h.get("amenities") or dir_data.get("amenities") or []
            images = h.get("images") or dir_data.get("images") or []
            reviews = h.get("reviews") or dir_data.get("reviews") or []

            # [PRO-FALLBACK] Cross-User Recovery for Rating & Review Count
            # If still missing after directory check, we search global data.
            if (rating is None or rating == 0 or review_count is None or review_count == 0) and h.get("serp_api_id"):
                sid = h["serp_api_id"]
                try:
                    g_res = await db.table("hotels").select("id, rating, review_count").eq("serp_api_id", sid).execute()
                    if g_res.data:
                        # First: try to get review_count directly from any hotel record
                        for gh in g_res.data:
                            if gh.get("review_count") and gh["review_count"] > 0:
                                review_count = gh["review_count"]
                                break
                        # Also get rating from hotel records if still missing
                        for gh in g_res.data:
                            if gh.get("rating") and gh["rating"] > 0:
                                rating = rating if (rating and rating > 0) else gh["rating"]
                                break

                        # If review_count still missing, check sentiment_history
                        if not review_count or review_count == 0:
                            g_hids = [str(gh["id"]) for gh in g_res.data]
                            gh_res = await db.table("sentiment_history").select("rating, review_count").in_("hotel_id", g_hids).order("recorded_at", desc=True).limit(1).execute()
                            if gh_res.data:
                                sh_rating = gh_res.data[0].get("rating")
                                sh_rc = gh_res.data[0].get("review_count")
                                if sh_rating and (not rating or rating == 0):
                                    rating = sh_rating
                                if sh_rc and sh_rc > 0:
                                    review_count = sh_rc

                        if rating or review_count:
                            logger.info(f"[GlobalPulse/ScoreCard] Recovered rating={rating}, reviews={review_count} for {sid}")
                except Exception:
                    pass

            enriched_hotels.append(
                {
                    **dir_data,
                    **h,
                    "review_count": review_count,
                    "rating": rating,
                    "stars": stars,
                    "image_url": image_url,
                    "latitude": latitude,
                    "longitude": longitude,
                    "sentiment_breakdown": item_sentiment,
                    "sentiment_raw_breakdown": translate_breakdown(raw_breakdown),
                    "guest_mentions": h.get("guest_mentions")
                    or generate_mentions(raw_breakdown),
                    "amenities": amenities,
                    "images": images,
                    "reviews": reviews,
                    "price_info": price_info,
                    "price_history": [
                        {
                            "price": float(p["price"]),
                            "recorded_at": p.get("recorded_at"),
                        }
                        for p in prices
                        if p.get("price") is not None
                    ],
                }
            )

        # 5. Value Synthesis
        market_avg: float = sum(active_prices) / len(active_prices) if active_prices else 0.0
        market_avg_rating = (
            sum(float(h.get("rating") or 0) for h in enriched_hotels)
            / len(enriched_hotels)
            if enriched_hotels
            else 0
        )
        for hotel_data in enriched_hotels:
            sentiment = hotel_data["sentiment_breakdown"]
            value_pillar = next((p for p in sentiment if p["name"] == "Value"), None)
            if value_pillar and value_pillar.get("total_mentioned", 0) == 0:
                price_info = hotel_data["price_info"]
                if price_info and isinstance(market_avg, (int, float)) and market_avg > 0:
                    ari = (price_info["current_price"] / market_avg) * 100
                    value_pillar.update(synthesize_value_score(ari))

        # 6. Final Aggregation
        target_hotel = next(
            (h for h in enriched_hotels if h.get("is_target_hotel")), None
        ) or (enriched_hotels[0] if enriched_hotels else None)
        competitors = [h for h in enriched_hotels if h != target_hotel]

        # Recent Searches Deduplication
        seen_searches = set()
        recent_searches = []
        active_names = {h["name"].lower().strip() for h in all_hotels}
        for s in recent_searches_raw:
            name = s.get("hotel_name")
            name_low = (name or "").lower().strip()
            if name and name_low not in seen_searches and name_low in active_names:
                recent_searches.append(s)
                seen_searches.add(name_low)
            if len(recent_searches) >= 10:
                break

        # [KAIZEN] Use profile next_scan_at as source of truth
        # This aligns the Dashboard UI with the actual backend scheduler.
        next_scan_at = core_profile_data.get("next_scan_at")

        # Fallback to calculated if next_scan_at is missing from profile
        if not next_scan_at:
            # ... (calculation logic remains same)
            freq = (
                (user_settings.get("check_frequency_minutes") or 0)
                if user_settings
                else 0
            )
            if freq > 0:
                latest = None
                for h in enriched_hotels:
                    if h.get("price_history"):
                        ts = h["price_history"][0]["recorded_at"]
                        if latest is None or ts > latest:
                            latest = ts
                if latest and isinstance(latest, str):
                    try:
                        last_run = datetime.fromisoformat(latest.replace("Z", "+00:00"))
                        next_scan_at = (last_run + timedelta(minutes=freq)).isoformat()
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"Failed to parse latest scan date '{latest}': {e}")

        # 8. Dynamic Market Insight (Sentiment Page bridging)
        synthetic_narrative = "No strategic narrative available yet. Run a scan to generate AI insights."
        comp_limit = 5  # Default comparison limit for dashboard UI
        if target_hotel and market_avg > 0:
            try:
                # [KAIZEN] Standardized top-level imports used here

                target_price = target_hotel.get("price_info", {}).get("current_price")
                if target_price and market_avg > 0 and market_avg_rating > 0:
                    ari = (target_price / market_avg) * 100
                    target_rating = float(target_hotel.get("rating") or 0.0)
                    sent_index = (target_rating / market_avg_rating) * 100
                    
                    # [FIX] Match signature in analysis_service.py
                    synthetic_narrative = generate_synthetic_narrative(
                        ari=ari,
                        sent_index=sent_index,
                        dna_text=target_hotel.get("pricing_dna_text"),
                        hotel_name=target_hotel.get("name"),
                    )
            except Exception as e:
                logger.warning(f"Narrative generation failed: {e}")

        # [NEW] Include Pulse Stats to eliminate separate frontend calls
        from backend.services.pulse_service import get_pulse_network_stats
        pulse_stats = await get_pulse_network_stats(db)

        return {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "recent_searches": recent_searches,
            "scan_history": scan_history,
            "recent_sessions": recent_sessions,
            "unread_alerts_count": unread_count,
            "comparison_limit": comp_limit,
            "next_scan_at": next_scan_at,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "profile": user_profile,
            "user_settings": user_settings,
            "market_insight": synthetic_narrative,
            "global_pulse": global_pulse,
            "pulse_stats": pulse_stats,
        }

    except Exception as e:
        logger.critical(f"DASHBOARD CRITICAL ERROR: {e}")
        import traceback

        traceback.print_exc()
        fallback_data["error"] = str(e)
        return fallback_data


async def get_recent_wins(db: Client, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetches anonymized recent price drops discovered by the Global Pulse network.
    """
    try:
        res = (
            db.table("alerts")
            .select("hotel_id, message, old_price, new_price, created_at")
            .ilike("message", "%Global Pulse%")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        raw_alerts = res.data or []
        if not raw_alerts:
            return []

        hotel_ids = list(set([a["hotel_id"] for a in raw_alerts]))
        hotels_res = (
            db.table("hotels")
            .select("id, name")
            .in_("id", hotel_ids)
            .is_("deleted_at", "null")
            .execute()
        )
        hotel_name_map = {h["id"]: h["name"] for h in hotels_res.data}

        wins = []
        for a in raw_alerts:
            pct = 0
            if a["old_price"] and a["old_price"] > 0:
                pct = round(
                    ((a["old_price"] - a["new_price"]) / a["old_price"]) * 100, 1
                )

            wins.append(
                {
                    "hotel_name": hotel_name_map.get(a["hotel_id"], "A shared hotel"),
                    "reduction": f"{pct}%",
                    "message": a["message"].replace("[Global Pulse] ", ""),
                    "timestamp": a["created_at"],
                }
            )
        return wins
    except Exception as e:
        logger.error(f"get_recent_wins failure: {e}")
        return []
