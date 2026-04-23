"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import HTTPException

from backend.services.analysis_service import (
    _extract_price,
    generate_synthetic_narrative,
    get_price_for_room,
)
from backend.services.price_comparator import price_comparator
from backend.utils.helpers import convert_currency
from backend.utils.logger import get_logger
from backend.utils.sentiment_utils import (
    generate_mentions,
    normalize_sentiment,
    synthesize_value_score,
    translate_breakdown,
)
from supabase import Client

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
        # AGENT_FIX: Sequential Data Fetching for Stability
        # Previous asyncio.to_thread + lambda approach was causing thread-safety crashes
        # with the Supabase client, leading to intermittent 500 errors on Vercel.
        fallback_data = {
            "target_hotel": None,
            "competitors": [],
            "recent_searches": [],
            "recent_sessions": [],
            "scan_history": [],
            "unread_alerts_count": 0,
            "active_scans": 0,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "market_insight": "Market data is currently being synchronized...",
        }

        # 1. User Profile
        profile_res = (
            db.table("user_profiles")
            .select("*")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )

        # 2. User Settings
        settings_res = (
            db.table("settings")
            .select("*")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )

        # 3. Unread Alerts
        alerts_res = (
            db.table("alerts")
            .select("id", count="exact")
            .eq("user_id", str(user_id))
            .eq("is_read", False)
            .execute()
        )

        # 4. Recent Searches
        searches_res = (
            db.table("query_logs")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )

        # 5. Scan History (Metadata only for counts/status)
        sessions_res = (
            db.table("scan_sessions")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )

        # 5.5 Active Scans Count
        # Fetching count of pending or running sessions specifically for the dashboard indicator.
        active_scans_res = (
            db.table("scan_sessions")
            .select("id", count="exact")
            .eq("user_id", str(user_id))
            .in_("status", ["pending", "running"])
            .execute()
        )
        active_scans_count = (
            active_scans_res.count
            if active_scans_res and hasattr(active_scans_res, "count")
            else 0
        )

        # 6. Hotels (Bulk Fetch via Many-to-Many Association)
        # AGENT_LOGIC: Join with user_hotels to support multi-user property tracking.
        res = (
            db.table("user_hotels")
            .select("*, hotel:hotels(*)")
            .eq("user_id", str(user_id))
            .execute()
        )
        all_associations = res.data or []

        all_hotels = []
        for assoc in all_associations:
            hotel = assoc.get("hotel")
            if hotel and not hotel.get("deleted_at"):
                # Inject user-specific association data into the hotel object
                # for backward compatibility and per-user customization.
                hotel["user_id"] = assoc.get("user_id")
                hotel["is_target_hotel"] = assoc.get("is_target", False)
                hotel["is_monitored"] = assoc.get("is_monitored", True)
                hotel["pricing_dna"] = assoc.get("pricing_dna")
                hotel["preferred_currency"] = assoc.get("preferred_currency", "TRY")
                hotel["fixed_check_in"] = assoc.get("fixed_check_in")
                hotel["fixed_check_out"] = assoc.get("fixed_check_out")
                hotel["default_adults"] = assoc.get("default_adults", 2)
                all_hotels.append(hotel)

        user_profile = (
            profile_res.data if profile_res and hasattr(profile_res, "data") else {}
        )
        user_settings = (
            settings_res.data if settings_res and hasattr(settings_res, "data") else {}
        )
        display_currency = user_settings.get("currency", "TRY")
        unread_count = (
            alerts_res.count if alerts_res and hasattr(alerts_res, "count") else 0
        )
        recent_searches_raw = (
            searches_res.data if searches_res and hasattr(searches_res, "data") else []
        )
        recent_sessions = (
            sessions_res.data if sessions_res and hasattr(sessions_res, "data") else []
        )

        # AGENT_FIX: Scan History Query (Mapping via Hotel IDs)
        # The price_logs table does not contain a user_id column.
        # We fetch the latest 10 logs across all the user's active hotels.
        scan_history = []
        if all_hotels:
            hids = [str(h["id"]) for h in all_hotels]
            hist_res = (
                db.table("price_logs")
                .select("*")
                .in_("hotel_id", hids)
                .order("recorded_at", desc=True)
                .limit(10)
                .execute()
            )
            scan_history = hist_res.data or []
        # If no hotels are found, we still return sessions, searches, and profile
        # to ensure the UI tiles don't look broken/desynchronized.
        if not all_hotels:
            logger.info(
                f"Dashboard: No hotels found for {user_id}, returning metadata only."
            )
            # AGENT_LOGIC: Direct field assignment avoids typing.MutableMapping.update errors in strict linters
            fallback_data["profile"] = user_profile
            fallback_data["user_settings"] = user_settings
            fallback_data["unread_alerts_count"] = unread_count
            fallback_data["recent_searches"] = []
            fallback_data["recent_sessions"] = recent_sessions
            fallback_data["scan_history"] = []
            return fallback_data

        # 2. Enrich Hotels with Master Directory data
        serp_ids = list(
            set(h.get("serp_api_id") for h in all_hotels if h.get("serp_api_id"))
        )
        directory_map = {}
        if serp_ids:
            dir_res = (
                db.table("hotel_directory")
                .select("*")
                .in_("serp_api_id", serp_ids)
                .execute()
            )
            for drecord in dir_res.data or []:
                directory_map[drecord["serp_api_id"]] = drecord

        # 3. Batch Fetch Price Logs for all hotels
        hotel_ids = [str(h["id"]) for h in all_hotels]
        hotel_prices_map = {}
        all_prices_res = (
            db.table("price_logs")
            .select("*, scan_sessions(adults, check_out_date)")
            .in_("hotel_id", hotel_ids)
            .order("recorded_at", desc=True)
            .limit(1000)
            .execute()
        )

        for p in all_prices_res.data or []:
            hid = str(p["hotel_id"])
            if hid not in hotel_prices_map:
                hotel_prices_map[hid] = []
            if len(hotel_prices_map[hid]) < 100:
                hotel_prices_map[hid].append(p)

        # 4. Process Hotel Data
        enriched_hotels = []
        active_prices = []
        for h in all_hotels:
            hid = str(h["id"])
            token = h.get("serp_api_id") or h.get("property_token")
            if not token:
                logger.info(
                    f"Dashboard Service: Hotel {h.get('name')} (ID: {hid}) has no token yet. Showing as pending."
                )

            dir_data = directory_map.get(h.get("serp_api_id"), {})
            prices = hotel_prices_map.get(hid, [])

            # Price Processing
            current_log = prices[0] if prices else None
            prev_log = None
            price_info = None

            if current_log:
                # AGENT_FIX: Find a comparable previous log (same stay duration and adults)
                # Comparing a 1-night stay with a 7-night stay is a common cause of -99% errors.
                curr_check_in = current_log.get("check_in_date")
                curr_sessions = current_log.get("scan_sessions") or {}
                curr_check_out = curr_sessions.get("check_out_date")
                curr_adults = curr_sessions.get("adults")

                for p in prices[1:]:
                    p_sessions = p.get("scan_sessions") or {}
                    if (p.get("check_in_date") == curr_check_in and 
                        p_sessions.get("check_out_date") == curr_check_out and 
                        p_sessions.get("adults") == curr_adults):
                        prev_log = p
                        break

                try:
                    # AGENT_FIX: Unified Source Routing
                    # Ensure we compare the SAME room category between scans.
                    target_room = h.get("room_type_standard") or "Standard"
                    curr_c = current_log.get("currency") or "TRY"
                    curr_p_raw, matched_name, confidence = get_price_for_room(
                        current_log, target_room, {}, currency=curr_c
                    )
                    
                    curr_p = None
                    if curr_p_raw is not None and curr_p_raw > 0:
                        curr_p = convert_currency(curr_p_raw, curr_c, display_currency)
                        active_prices.append(curr_p)

                    # Get previous price for the same room category
                    prev_p = None
                    if prev_log:
                        prev_c = prev_log.get("currency") or "TRY"
                        p_val_prev, _, _ = get_price_for_room(
                            prev_log, target_room, {}, currency=prev_c
                        )
                        if p_val_prev is not None and p_val_prev > 0:
                            prev_p = convert_currency(p_val_prev, prev_c, display_currency)

                    # AGENT_FIX: Safety Guard
                    # Only calculate trend if both prices are valid.
                    # This prevents erratic -99.9% shifts when rooms go in/out of stock.
                    if curr_p is not None and curr_p > 0 and prev_p is not None and prev_p > 0:
                        trend_obj, change = price_comparator.calculate_trend(curr_p, prev_p)
                        trend_val = str(getattr(trend_obj, "value", trend_obj))
                    else:
                        trend_val = "stable"
                        change = 0.0

                    price_info = {
                        "current_price": curr_p,
                        "previous_price": prev_p,
                        "currency": curr_c,
                        "name": h.get("name"),
                        "trend": trend_val,
                        "change_percent": change,
                        "recorded_at": current_log.get("recorded_at"),
                        "vendor": current_log.get("vendor"),
                        "check_in": current_log.get("check_in_date"),
                        "check_out": current_log.get("scan_sessions", {}).get(
                            "check_out_date"
                        )
                        if current_log.get("scan_sessions")
                        else None,
                        "adults": current_log.get("scan_sessions", {}).get("adults")
                        if current_log.get("scan_sessions")
                        else 2,
                        "offers": current_log.get("parity_offers") or [],
                        "room_types": current_log.get("room_types") or [],
                    }
                except Exception as e:
                    logger.warning(f"Price processing error for {hid}: {e}")

            # Sentiment Processing
            # AGENT_FIX: Sentiment Fallback (Global Pulse)
            # If the user's specific hotel record is missing sentiment (e.g. newly re-added),
            # we try the global directory first, then fallback to ANY history share the same serp_api_id.
            raw_breakdown = (
                h.get("sentiment_breakdown")
                or dir_data.get("sentiment_breakdown")
                or []
            )

            if not raw_breakdown and h.get("serp_api_id"):
                sid = h["serp_api_id"]
                logger.info(
                    f"[GlobalPulse/Dashboard] Recovering sentiment for {hid} (SERP: {sid})"
                )
                try:
                    # AGENT_LOGIC: Multi-Tenant Recovery: Scan across ANY hotel records for this property.
                    # Since hotels are shared, we just need ANY record that has the data.
                    # We query by serp_api_id directly in the sentiment_history table or hotel_directory.
                    # First check directories
                    if sid in directory_map:
                        raw_breakdown = (
                            directory_map[sid].get("sentiment_breakdown") or []
                        )

                    if not raw_breakdown:
                        # Fallback: Find most recent history for THIS property (independent of current user)
                        # We use admin_db query style (simulated via rls if permissions allow,
                        # but here we just query for the SERP id matches)
                        sh_res = (
                            db.table("sentiment_history")
                            .select("sentiment_breakdown")
                            .eq("hotel_id", hid)  # Try specific first
                            .order("recorded_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        if sh_res.data:
                            raw_breakdown = (
                                sh_res.data[0].get("sentiment_breakdown") or []
                            )
                except Exception as e:
                    logger.error(
                        f"[GlobalPulse/Dashboard] Recovery failed for {sid}: {e}"
                    )
            item_sentiment = normalize_sentiment(raw_breakdown)

            # AGENT_FIX: Resilient Metadata Merging
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

            # AGENT_LOGIC: Cross-User Recovery for Rating & Review Count (Pro Fallback)
            # If still missing after directory check, we search global data.
            if (
                rating is None
                or rating == 0
                or review_count is None
                or review_count == 0
            ) and h.get("serp_api_id"):
                sid = h["serp_api_id"]
                try:
                    g_res = (
                        db.table("hotels")
                        .select("id, rating, review_count")
                        .eq("serp_api_id", sid)
                        .execute()
                    )
                    if g_res.data:
                        # First: try to get review_count directly from any hotel record
                        for gh in g_res.data:
                            if gh.get("review_count") and gh["review_count"] > 0:
                                review_count = gh["review_count"]
                                break
                        # Also get rating from hotel records if still missing
                        for gh in g_res.data:
                            if gh.get("rating") and gh["rating"] > 0:
                                rating = (
                                    rating if (rating and rating > 0) else gh["rating"]
                                )
                                break

                        # If review_count still missing, check sentiment_history
                        if not review_count or review_count == 0:
                            g_hids = [str(gh["id"]) for gh in g_res.data]
                            gh_res = (
                                db.table("sentiment_history")
                                .select("rating, review_count")
                                .in_("hotel_id", g_hids)
                                .order("recorded_at", desc=True)
                                .limit(1)
                                .execute()
                            )
                            if gh_res.data:
                                sh_rating = gh_res.data[0].get("rating")
                                sh_rc = gh_res.data[0].get("review_count")
                                if sh_rating and (not rating or rating == 0):
                                    rating = sh_rating
                                if sh_rc and sh_rc > 0:
                                    review_count = sh_rc

                        if rating or review_count:
                            logger.info(
                                f"[GlobalPulse/ScoreCard] Recovered rating={rating}, reviews={review_count} for {sid}"
                            )
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
                            "check_in_date": p.get("check_in_date"),
                        }
                        for p in prices
                        if p.get("price") is not None
                    ],
                }
            )

        # 5. Value Synthesis
        market_avg: float = (
            sum(active_prices) / len(active_prices) if active_prices else 0.0
        )
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
                if (
                    price_info
                    and price_info.get("current_price") is not None
                    and isinstance(market_avg, (int, float))
                    and market_avg > 0
                ):
                    ari = (price_info["current_price"] / market_avg) * 100
                    value_pillar.update(synthesize_value_score(ari))

            # AGENT_LOGIC: Calculate Overall Sentiment Score (Average of pillars)
            if sentiment:
                valid_pillars = [
                    p["rating"] for p in sentiment if p.get("rating") is not None
                ]
                if valid_pillars:
                    hotel_data["overall_sentiment_score"] = round(
                        sum(valid_pillars) / len(valid_pillars), 1
                    )
                else:
                    hotel_data["overall_sentiment_score"] = 0.0

            # AGENT_LOGIC: Calculate Rate Parity Score
            price_info = hotel_data.get("price_info")
            target_room = h.get("room_type_standard") or "Standard"
            
            # AGENT_FIX: Consistency check
            # Only calculate parity if we are tracking a "Standard" room category.
            # Comparing a Suite price to OTA Lead prices leads to 0% parity scores (apples to oranges).
            standard_keys = ["standard", "standart", "economy", "ekonomik", "base", "classic"]
            is_standard_tracking = any(k in target_room.lower() for k in standard_keys) or target_room == "Standard"

            if (
                is_standard_tracking
                and price_info
                and price_info.get("current_price")
                and price_info.get("offers")
            ):
                target_price = price_info["current_price"]
                offers = price_info["offers"]

                # Find the lowest price among all offers (OTAs)
                # AGENT_FIX: Ensure numerical extraction
                ota_prices = []
                for of in offers:
                    p_raw = of.get("price")
                    if p_raw is not None:
                        p_val = _extract_price(p_raw)
                        if p_val and p_val > 0:
                            ota_prices.append(p_val)

                if ota_prices:
                    cheapest_ota = min(ota_prices)
                    # Parity score: 100% if we are equal or cheaper than cheapest OTA
                    if target_price <= cheapest_ota:
                        hotel_data["parity_score"] = 100
                    else:
                        # Penalty for being more expensive
                        # If we are 10% more expensive, score drops to 90, etc.
                        diff_percent = ((target_price - cheapest_ota) / cheapest_ota) * 100
                        hotel_data["parity_score"] = max(0, int(100 - diff_percent))
                else:
                    hotel_data["parity_score"] = 100  # No competition found = in parity
            else:
                # Default for non-standard rooms where we lack comparable OTA data
                hotel_data["parity_score"] = 100 if is_standard_tracking else None

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

        # 8. Dynamic Market Insight (Sentiment Page bridging)
        synthetic_narrative = (
            "No strategic narrative available yet. Run a scan to generate AI insights."
        )
        comp_limit = 5  # Default comparison limit for dashboard UI
        if target_hotel and market_avg > 0:
            try:
                # AGENT_LOGIC: Standardized top-level imports used here

                target_price = target_hotel.get("price_info", {}).get("current_price")
                if target_price and market_avg > 0 and market_avg_rating > 0:
                    ari = (target_price / market_avg) * 100
                    target_rating = float(target_hotel.get("rating") or 0.0)
                    sent_index = (target_rating / market_avg_rating) * 100

                    # AGENT_FIX: Match signature in analysis_service.py
                    synthetic_narrative = generate_synthetic_narrative(
                        ari=ari,
                        sent_index=sent_index,
                        dna_text=target_hotel.get("pricing_dna_text"),
                        hotel_name=target_hotel.get("name"),
                    )
            except Exception as e:
                logger.warning(f"Narrative generation failed: {e}")

        # Calculate authoritative last sync time from price logs
        sync_times = [
            p.get("recorded_at")
            for p in (all_prices_res.data or [])
            if p.get("recorded_at")
        ]
        last_sync = (
            max(sync_times) if sync_times else datetime.now(timezone.utc).isoformat()
        )

        return {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "recent_searches": recent_searches,
            "scan_history": scan_history,
            "recent_sessions": recent_sessions,
            "unread_alerts_count": unread_count,
            "active_scans": active_scans_count,
            "comparison_limit": comp_limit,
            "last_updated": last_sync,
            "profile": user_profile,
            "user_settings": user_settings,
            "market_insight": synthetic_narrative,
            "agg_metrics": {
                "avg_rating": float(target_hotel.get("overall_sentiment_score") or 0.0)
                if target_hotel
                else 0.0,
                "rate_parity_score": int(target_hotel.get("parity_score") or 0)
                if target_hotel
                else 0,
            },
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
    Uses the is_global_pulse flag for reliable filtering.
    """
    try:
        res = (
            db.table("alerts")
            .select("hotel_id, message, old_price, new_price, created_at")
            .eq("is_global_pulse", True)
            .is_("user_id", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        raw_alerts = res.data or []
        if not raw_alerts:
            return []

        hotel_ids = list(set([a["hotel_id"] for a in raw_alerts]))
        res = (
            db.table("hotels")
            .select("id, name, deleted_at")
            .in_("id", hotel_ids)
            .execute()
        )
        # AGENT_LOGIC: Programmatic filtering (Robust)
        hotels_data = [h for h in (res.data or []) if not h.get("deleted_at")]
        hotel_name_map = {h["id"]: h["name"] for h in hotels_data}

        wins = []
        for a in raw_alerts:
            pct = 0
            if a["old_price"] and a["old_price"] > 0:
                # Calculate change percentage based on price shift
                # This works for both price drops and parity breaches (using direct/OTA prices)
                if a["old_price"] > a["new_price"]:
                    pct = round(
                        ((a["old_price"] - a["new_price"]) / a["old_price"]) * 100, 1
                    )
                else:
                    # In case of increases or complex shifts, just show absolute difference pct
                    pct = round(
                        (abs(a["old_price"] - a["new_price"]) / a["old_price"]) * 100, 1
                    )

            wins.append(
                {
                    "hotel_name": hotel_name_map.get(a["hotel_id"], "A shared hotel"),
                    "reduction": f"{pct}%",
                    "message": a["message"].replace("Global Pulse: ", ""),
                    "timestamp": a["created_at"],
                }
            )
        return wins
    except Exception as e:
        logger.error(f"get_recent_wins failure: {e}")
        return []
