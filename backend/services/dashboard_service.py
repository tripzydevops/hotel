"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
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
    get_price_for_room,
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
        
        # 1. User Profile
        profile_res = db.table("user_profiles").select("*").eq("user_id", str(user_id)).maybe_single().execute()
        
        # 2. User Settings
        settings_res = db.table("settings").select("*").eq("user_id", str(user_id)).maybe_single().execute()
        
        # 3. Unread Alerts
        alerts_res = db.table("alerts").select("id", count="exact").eq("user_id", str(user_id)).eq("is_read", False).execute()
        
        # 4. Recent Searches
        searches_res = db.table("query_logs").select("*").eq("user_id", str(user_id)).order("created_at", desc=True).limit(20).execute()
        
        # 5. Scan History (Metadata only for counts/status)
        sessions_res = db.table("scan_sessions").select("*").eq("user_id", str(user_id)).order("created_at", desc=True).limit(5).execute()
        
        # 6. Hotels (Bulk Fetch via Many-to-Many Association)
        # KAİZEN: Join with user_hotels to support multi-user property tracking.
        res = db.table("user_hotels").select("*, hotel:hotels(*)").eq("user_id", str(user_id)).execute()
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

        # 7. Core Profile (for next_scan_at)
        core_profile_res = db.table("profiles").select("next_scan_at").eq("id", str(user_id)).maybe_single().execute()

        user_profile = (
            profile_res.data if profile_res and hasattr(profile_res, "data") else {}
        )
        user_settings = (
            settings_res.data if settings_res and hasattr(settings_res, "data") else {}
        )
        unread_count = (
            alerts_res.count if alerts_res and hasattr(alerts_res, "count") else 0
        )
        recent_searches_raw = (
            searches_res.data if searches_res and hasattr(searches_res, "data") else []
        )
        recent_sessions = (
            sessions_res.data if sessions_res and hasattr(sessions_res, "data") else []
        )

        # [FIX] Scan History Query (Mapping via Hotel IDs)
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
            logger.info(f"Dashboard: No hotels found for {user_id}, returning metadata only.")
            # [KAIZEN] Direct field assignment avoids typing.MutableMapping.update errors in strict linters
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
            token = h.get("property_token") or h.get("serp_api_id")
            if not token:
                logger.info(f"Dashboard Service: Hotel {h.get('name')} (ID: {hid}) has no token yet. Showing as pending.")

            dir_data = directory_map.get(h.get("serp_api_id"), {})
            prices = hotel_prices_map.get(hid, [])

            # Price Processing
            current_log = prices[0] if prices else None
            prev_log = prices[1] if len(prices) > 1 else None
            price_info = None
            if current_log:
                try:
                    # [NEW] Use Strict Source Routing for Dashboard Prices
                    # This ensures the 'standard' price in dashboard matches the analysis selection.
                    target_room = h.get("room_type_standard") or "Standard"
                    curr_p, matched_name, confidence = get_price_for_room(current_log, target_room, {})
                    
                    if curr_p is not None:
                        curr_c = current_log.get("currency") or "TRY"
                        active_prices.append(curr_p)

                    prev_p = None
                    if prev_log and prev_log.get("price") is not None:
                        raw_prev = float(prev_log["price"])
                        prev_c = prev_log.get("currency") or "TRY"
                        prev_p = convert_currency(raw_prev, prev_c, curr_c)

                    trend_obj, change = price_comparator.calculate_trend(curr_p, prev_p)
                    trend_val = str(getattr(trend_obj, "value", trend_obj))

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
                        "check_out": current_log.get("scan_sessions", {}).get("check_out_date") if current_log.get("scan_sessions") else None,
                        "adults": current_log.get("scan_sessions", {}).get("adults") if current_log.get("scan_sessions") else 2,
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
                    # [KAIZEN] Multi-Tenant Recovery: Scan across ANY hotel records for this property.
                    # Since hotels are shared, we just need ANY record that has the data.
                    # We query by serp_api_id directly in the sentiment_history table or hotel_directory.
                    # First check directories
                    if sid in directory_map:
                        raw_breakdown = directory_map[sid].get("sentiment_breakdown") or []
                    
                    if not raw_breakdown:
                        # Fallback: Find most recent history for THIS property (independent of current user)
                        # We use admin_db query style (simulated via rls if permissions allow, 
                        # but here we just query for the SERP id matches)
                        sh_res = (
                            db.table("sentiment_history")
                            .select("sentiment_breakdown")
                            .eq("hotel_id", hid) # Try specific first
                            .order("recorded_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        if sh_res.data:
                            raw_breakdown = sh_res.data[0].get("sentiment_breakdown") or []
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
                    g_res = db.table("hotels").select("id, rating, review_count").eq("serp_api_id", sid).execute()
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
                            gh_res = db.table("sentiment_history").select("rating, review_count").in_("hotel_id", g_hids).order("recorded_at", desc=True).limit(1).execute()
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
                            "check_in_date": p.get("check_in_date"),
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
                if (
                    price_info 
                    and price_info.get("current_price") is not None 
                    and isinstance(market_avg, (int, float)) 
                    and market_avg > 0
                ):
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
        next_scan_at = (
            core_profile_res.data.get("next_scan_at")
            if core_profile_res and hasattr(core_profile_res, "data") and core_profile_res.data
            else None
        )

        # Fallback to calculated if next_scan_at is missing from profile
        if not next_scan_at:
            freq = (
                (user_settings.get("check_frequency_minutes") or 0)
                if user_settings and isinstance(user_settings, dict)
                else 0
            )
            if freq > 0:
                latest_ts = None
                for h in enriched_hotels:
                    if h.get("price_history"):
                        ts = h["price_history"][0].get("recorded_at")
                        if ts:
                            if latest_ts is None or ts > latest_ts:
                                latest_ts = ts
                
                if latest_ts and isinstance(latest_ts, str):
                    try:
                        last_run = datetime.fromisoformat(latest_ts.replace("Z", "+00:00"))
                        next_scan_at = (last_run + timedelta(minutes=freq)).isoformat()
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"Failed to parse latest scan date '{latest_ts}': {e}")
                else:
                    # Final fallback: If no history exists, next scan is scheduled for Now + freq
                    next_scan_at = (datetime.now(timezone.utc) + timedelta(minutes=freq)).isoformat()

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

        marketplace_data = {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "market_average": market_avg,
            "synthetic_narrative": synthetic_narrative,
            "last_updated": datetime.now().isoformat(),
            "next_scan_at": next_scan_at,
        }

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
            "market_insight": synthetic_narrative, # Changed from market_insight to synthetic_narrative
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
        res = (
            db.table("hotels")
            .select("id, name, deleted_at")
            .in_("id", hotel_ids)
            .execute()
        )
        # [ROBUST] Programmatic filtering
        hotels_data = [h for h in (res.data or []) if not h.get("deleted_at")]
        hotel_name_map = {h["id"]: h["name"] for h in hotels_data}

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
