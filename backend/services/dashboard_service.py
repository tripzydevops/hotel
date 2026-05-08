"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import HTTPException
from postgrest import CountMethod

from backend.services.analysis_service import (
    _extract_price,
    generate_synthetic_narrative,
    get_price_for_room,
)
from backend.services.price_comparator import price_comparator
from backend.utils.helpers import convert_currency
from backend.utils.vendor_normalizer import normalize_vendor_name
from backend.utils.logger import get_logger
from backend.utils.sentiment_utils import (
    generate_mentions,
    normalize_sentiment,
    synthesize_value_score,
    translate_breakdown,
)
from supabase import Client

logger = get_logger(__name__)


# ─── Phase-1 Query Helpers (each builds an independent query chain) ──────────
# Using named functions instead of lambdas prevents closure-scoping bugs
# that caused the previous asyncio.to_thread attempt to crash.
# httpx.Client (used by supabase-py) is thread-safe for concurrent requests.

def _fetch_profile(db: Client, uid: str):
    return db.table("user_profiles").select("*").eq("user_id", uid).maybe_single().execute()

def _fetch_settings(db: Client, uid: str):
    return db.table("settings").select("*").eq("user_id", uid).maybe_single().execute()

def _fetch_unread_alerts(db: Client, uid: str):
    return db.table("alerts").select("id", count=CountMethod.exact).eq("user_id", uid).eq("is_read", False).execute()

def _fetch_recent_searches(db: Client, uid: str):
    return db.table("query_logs").select("*").eq("user_id", uid).order("created_at", desc=True).limit(20).execute()

def _fetch_sessions(db: Client, uid: str):
    return db.table("scan_sessions").select("*").eq("user_id", uid).order("created_at", desc=True).limit(5).execute()

def _fetch_active_scans(db: Client, uid: str):
    return db.table("scan_sessions").select("id", count=CountMethod.exact).eq("user_id", uid).in_("status", ["pending", "running"]).execute()

def _fetch_user_hotels(db: Client, uid: str):
    return (
        db.table("user_hotels")
        .select(
            "*, hotel:hotels(id, name, currency, room_types, stars, rating, review_count, "
            "image_url, latitude, longitude, amenities, images, reviews, other_sites_reviews, "
            "guest_mentions, sentiment_breakdown, serp_api_id, property_token, deleted_at, address, location, "
            "market_offers, parity_offers, offers)"
        )
        .eq("user_id", uid)
        .execute()
    )


# ─── Phase-2 Query Helpers (depend on hotel data from Phase-1) ───────────────

def _fetch_scan_history(db: Client, hotel_ids: list):
    return db.table("price_logs").select("*").in_("hotel_id", hotel_ids).order("recorded_at", desc=True).limit(10).execute()

def _fetch_directory(db: Client, serp_ids: list):
    return db.table("hotel_directory").select("*").in_("serp_api_id", serp_ids).execute()

def _fetch_batch_prices(db: Client, hotel_ids: list):
    return (
        db.table("price_logs")
        .select(
            "id, hotel_id, price, currency, room_types, offers, parity_offers, market_offers, recorded_at, "
            "check_in_date, scan_sessions(adults, check_out_date)"
        )
        .in_("hotel_id", hotel_ids)
        .order("recorded_at", desc=True)
        .limit(1000)
        .execute()
    )


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
        # PERF_FIX: Parallel Data Fetching via asyncio.gather
        # Each _fetch_* helper builds an independent query chain from the db client,
        # avoiding the lambda closure bug that crashed the previous attempt.
        # Reduces Phase-1 latency from sum-of-7 RTTs to max-of-7.
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

        uid = str(user_id)

        # Phase 1: Fire all 7 independent user-scoped queries in parallel
        (
            profile_res,
            settings_res,
            alerts_res,
            searches_res,
            sessions_res,
            active_scans_res,
            hotels_res,
        ) = await asyncio.gather(
            asyncio.to_thread(_fetch_profile, db, uid),
            asyncio.to_thread(_fetch_settings, db, uid),
            asyncio.to_thread(_fetch_unread_alerts, db, uid),
            asyncio.to_thread(_fetch_recent_searches, db, uid),
            asyncio.to_thread(_fetch_sessions, db, uid),
            asyncio.to_thread(_fetch_active_scans, db, uid),
            asyncio.to_thread(_fetch_user_hotels, db, uid),
        )

        active_scans_count = (
            active_scans_res.count
            if active_scans_res and hasattr(active_scans_res, "count")
            else 0
        )

        # Process hotel associations
        all_associations = hotels_res.data or []
        all_hotels = []
        for assoc in all_associations:
            hotel = assoc.get("hotel")
            if hotel and not hotel.get("deleted_at"):
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
            hids = [str(h.get("id")) for h in all_hotels if isinstance(h, dict) and h.get("id") is not None]
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
                if isinstance(drecord, dict):
                    sid = drecord.get("serp_api_id")
                    if sid is not None:
                        directory_map[sid] = drecord

        # 3. Batch Fetch Price Logs for all hotels using RPC (addresses N+1 issue)
        hotel_ids = []
        for h in all_hotels:
            if isinstance(h, dict):
                hid = h.get("id")
                if hid is not None:
                    hotel_ids.append(str(hid))
        hotel_prices_map = {}
        
        try:
            # LATERAL JOIN RPC: Fetches top 20 logs per hotel in a single round-trip
            rpc_res = await asyncio.to_thread(
                lambda: db.rpc("get_batch_hotel_prices", {"p_hotel_ids": hotel_ids, "p_limit": 20}).execute()
            )
            hotel_prices_map = rpc_res.data or {}
        except Exception as e:
            logger.error(f"[Dashboard] Batch price fetch failed: {e}")
            # Fallback to empty results to prevent dashboard crash
            hotel_prices_map = {hid: [] for hid in hotel_ids}

        # 3.5. Batch Recovery for Missing Sentiment and Ratings
        missing_sentiment_hids = []
        missing_rating_sids = []
        for h in all_hotels:
            if isinstance(h, dict):
                serp_api_id = h.get("serp_api_id")
                dir_data = directory_map.get(serp_api_id) if serp_api_id else {}
                if not isinstance(dir_data, dict):
                    dir_data = {}
                raw_breakdown = h.get("sentiment_breakdown") or dir_data.get("sentiment_breakdown")
                hid = h.get("id")
                if not raw_breakdown and serp_api_id and hid is not None:
                    missing_sentiment_hids.append(str(hid))
                
                review_count = h.get("review_count") or dir_data.get("review_count")
                rating = h.get("rating") or dir_data.get("rating")
                if (rating is None or rating == 0 or review_count is None or review_count == 0) and serp_api_id:
                    missing_rating_sids.append(serp_api_id)
        recovered_sentiment_map = {}
        if missing_sentiment_hids:
            def _fetch_missing_sentiments(hids):
                return db.table("sentiment_history").select("hotel_id, sentiment_breakdown").in_("hotel_id", hids).order("recorded_at", desc=True).execute()
            try:
                sh_res = await asyncio.to_thread(_fetch_missing_sentiments, missing_sentiment_hids)
                for row in sh_res.data or []:
                    hid = str(row["hotel_id"])
                    if hid not in recovered_sentiment_map:
                        recovered_sentiment_map[hid] = row.get("sentiment_breakdown") or []
            except Exception as e:
                logger.error(f"[GlobalPulse/Dashboard] Batch sentiment recovery failed: {e}")

        recovered_ratings_map = {}
        if missing_rating_sids:
            def _fetch_missing_ratings(sids):
                return db.table("hotels").select("id, serp_api_id, rating, review_count").in_("serp_api_id", sids).execute()
            try:
                g_res = await asyncio.to_thread(_fetch_missing_ratings, missing_rating_sids)
                for gh in g_res.data or []:
                    sid = gh.get("serp_api_id")
                    if not sid:
                        continue
                    if sid not in recovered_ratings_map:
                        recovered_ratings_map[sid] = {"rating": None, "review_count": None, "hids": []}
                    recovered_ratings_map[sid]["hids"].append(str(gh["id"]))
                    if gh.get("review_count") and gh["review_count"] > 0 and not recovered_ratings_map[sid]["review_count"]:
                        recovered_ratings_map[sid]["review_count"] = gh["review_count"]
                    if gh.get("rating") and gh["rating"] > 0 and not recovered_ratings_map[sid]["rating"]:
                        recovered_ratings_map[sid]["rating"] = gh["rating"]
                
                sids_still_missing = [sid for sid, d in recovered_ratings_map.items() if not d["review_count"]]
                if sids_still_missing:
                    all_hids_recovery = []
                    for sid in sids_still_missing:
                        all_hids_recovery.extend(recovered_ratings_map[sid]["hids"])
                    if all_hids_recovery:
                        def _fetch_sh_ratings(hids):
                            return db.table("sentiment_history").select("hotel_id, rating, review_count").in_("hotel_id", hids).order("recorded_at", desc=True).execute()
                        sh_res = await asyncio.to_thread(_fetch_sh_ratings, all_hids_recovery)
                        for row in sh_res.data or []:
                            hid = str(row["hotel_id"])
                            for sid, d in recovered_ratings_map.items():
                                if hid in d["hids"]:
                                    if row.get("review_count") and not d["review_count"]:
                                        d["review_count"] = row["review_count"]
                                    if row.get("rating") and not d["rating"]:
                                        d["rating"] = row["rating"]
                                    break
            except Exception as e:
                logger.error(f"[GlobalPulse/Dashboard] Batch rating recovery failed: {e}")

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
            
            # AGENT_FIX: Historical Data Harvesting (Resilience against empty recent scans)
            # Find the most recent log that actually contains offers
            offers_log = current_log
            
            if prices:
                # AGENT_FIX: Most-Complete-Log Heuristic
                # Instead of just taking the LATEST log with any data (which might be a limited hourly price_search),
                # we search the recent history for the most complete log (max offers).
                max_offers_count = -1
                
                for p in prices:
                    # Count total offers across all possible keys
                    p_offers_count = 0
                    for k in ["offers", "ota_prices", "parity_offers", "market_offers"]:
                        val = p.get(k)
                        if val and isinstance(val, list):
                            p_offers_count = max(p_offers_count, len(val))
                    
                    if p_offers_count > max_offers_count:
                        max_offers_count = p_offers_count
                        offers_log = p
                
                # If even the "best" found is empty, fallback to current_log
                if max_offers_count <= 0:
                    offers_log = current_log


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

                    # KAİZEN 2026: Enhanced Price Info Extraction
                    active_currency = current_log.get("currency") or display_currency or "TRY"
                    
                    # Room Types Extraction (Resilient Multi-Variant Aggregation)
                    all_rooms_seen = {}
                    if prices:
                        for p in prices:
                            for rt in (p.get("room_types") or []):
                                if isinstance(rt, dict) and rt.get("name"):
                                    name_key = rt.get("name", "").strip().lower()
                                    price_key = str(rt.get("price") or "").strip()
                                    source_key = str(rt.get("source") or rt.get("vendor") or "").strip().lower()
                                    composite_key = f"{name_key}_{price_key}_{source_key}"
                                    if composite_key not in all_rooms_seen:
                                        all_rooms_seen[composite_key] = rt

                    # Also include any unique room types from the master hotel record
                    for rt in (h.get("room_types") or []):
                        if isinstance(rt, dict) and rt.get("name"):
                            name_key = rt.get("name", "").strip().lower()
                            price_key = str(rt.get("price") or "").strip()
                            source_key = str(rt.get("source") or rt.get("vendor") or "").strip().lower()
                            composite_key = f"{name_key}_{price_key}_{source_key}"
                            if composite_key not in all_rooms_seen:
                                all_rooms_seen[composite_key] = rt
                                
                    raw_rooms = list(all_rooms_seen.values())
                    
                    # Offers Extraction with Vendor Logic - AGGREGATE all available sources
                    raw_offers = []
                    seen_offers = set()
                    
                    if offers_log:
                        for key in ["offers", "ota_prices", "parity_offers", "market_offers"]:
                            val = offers_log.get(key)
                            if val and isinstance(val, list):
                                for of in val:
                                    if not isinstance(of, dict):
                                        continue
                                    # Create a unique key for deduplication
                                    vendor = normalize_vendor_name(of.get("vendor") or of.get("ota_name") or of.get("name") or "Unknown")
                                    price = _extract_price(of.get("price"))
                                    offer_key = f"{vendor}_{price}"
                                    if offer_key not in seen_offers:
                                        raw_offers.append(of)
                                        seen_offers.add(offer_key)

                    # AGENT_FIX: OTA Fallback from hotels table (market_offers > parity_offers > offers)
                    if not raw_offers:
                        for key in ["market_offers", "parity_offers", "offers"]:
                            val = h.get(key)
                            if val and isinstance(val, list):
                                for of in val:
                                    if not isinstance(of, dict):
                                        continue
                                    vendor = normalize_vendor_name(of.get("vendor") or of.get("ota_name") or of.get("name") or "Unknown")
                                    price = _extract_price(of.get("price"))
                                    offer_key = f"{vendor}_{price}"
                                    if offer_key not in seen_offers:
                                        raw_offers.append(of)
                                        seen_offers.add(offer_key)

                    # Secondary fallback: reconstruct from room_types if still empty
                    if not raw_offers and h.get("room_types"):
                        for rt in h["room_types"]:
                            if isinstance(rt, dict) and rt.get("price"):
                                raw_offers.append({
                                    "vendor": rt.get("source") or rt.get("vendor") or "Unknown",
                                    "price": rt.get("price"),
                                    "currency": rt.get("currency"),
                                    "is_direct": "website" in str(rt.get("source", "")).lower() or "direct" in str(rt.get("source", "")).lower(),
                                    "room_type": rt.get("name")
                                })

                    processed_offers = []
                    for of in raw_offers:
                        if not isinstance(of, dict):
                            continue
                        
                        # Vendor Extraction Logic: Prioritize 'vendor' -> 'ota_name' -> 'name'
                        v_raw = of.get("vendor") or of.get("source") or of.get("site") or of.get("ota_name") or of.get("name") or "Unknown"
                        v_name = normalize_vendor_name(v_raw)
                        
                        of_cur = of.get("currency") or active_currency
                        p_raw = of.get("price")
                        p_val_extracted = _extract_price(p_raw, currency=of_cur)
                        
                        # AGENT_FIX: Convert offer price to user preference (Fix for USD showing instead of TL)
                        p_val = convert_currency(p_val_extracted, of_cur, display_currency) if p_val_extracted and p_val_extracted > 0 else 0
                        
                        # AGENT_FIX: Filter out offers with no valid price (Fix for 0 price entries in UI)
                        if p_val is None or p_val <= 0:
                            continue

                        processed_offers.append({
                            "vendor": v_name,
                            "price": p_val,
                            "currency": display_currency,
                            "url": of.get("url") or of.get("link"),
                            "is_direct": of.get("is_direct", False),
                            "room_type": of.get("room_type") or of.get("room_name") or of.get("room")
                        })

                    # AGENT_FIX: Convert prices in raw_rooms to display_currency
                    processed_rooms = []
                    for rt in raw_rooms:
                        if not isinstance(rt, dict):
                            continue
                        rt_copy = rt.copy()
                        if rt_copy.get("price"):
                            rt_cur = rt_copy.get("currency") or active_currency
                            rt_p_raw = rt_copy.get("price")
                            rt_p_val = _extract_price(rt_p_raw, currency=rt_cur)
                            if rt_p_val and rt_p_val > 0:
                                rt_copy["price"] = convert_currency(rt_p_val, rt_cur, display_currency)
                                rt_copy["currency"] = display_currency
                        processed_rooms.append(rt_copy)
                    raw_rooms = processed_rooms

                    price_info = {
                        "current_price": curr_p,
                        "previous_price": prev_p,
                        "currency": display_currency,
                        "name": h.get("name"),
                        "trend": trend_val,
                        "change_percent": change,
                        "recorded_at": current_log.get("recorded_at"),
                        "vendor": current_log.get("vendor") or current_log.get("source") or current_log.get("site") or "Unknown",
                        "check_in": current_log.get("check_in_date"),
                        "check_out": current_log.get("scan_sessions", {}).get("check_out_date") if current_log.get("scan_sessions") else None,
                        "adults": current_log.get("scan_sessions", {}).get("adults") if current_log.get("scan_sessions") else 2,
                        "offers": processed_offers,
                        "room_types": raw_rooms,
                    }
                except Exception as e:
                    logger.warning(f"Price processing error for {hid}: {e}")

            # KAİZEN 2026: Resilient Price Info Construction (Always Run)
            # Even if no recent price_logs exist, we must provide a baseline price_info 
            # using the cached data in the hotels table (market_offers, room_types).
            if not price_info:
                # Use current price from the hotels table if available
                curr_p_raw = h.get("price") or h.get("current_price") or 0
                prev_p_raw = h.get("previous_price") or curr_p_raw
                h_cur = h.get("currency") or "TRY"
                
                # AGENT_FIX: Convert baseline prices to user preference (Fix for USD showing instead of TL)
                curr_p = convert_currency(curr_p_raw, h_cur, display_currency)
                prev_p = convert_currency(prev_p_raw, h_cur, display_currency)
                active_currency = display_currency
                
                # Room Types Baseline
                raw_rooms = h.get("room_types") or []
                
                # Offers Baseline
                raw_offers = []
                for key in ["market_offers", "parity_offers", "offers"]:
                    val = h.get(key)
                    if val and isinstance(val, list) and len(val) > 0:
                        raw_offers = val
                        break
                
                # Process Offers for UI compatibility
                processed_offers = []
                for of in raw_offers:
                    if not isinstance(of, dict):
                        continue
                    v_raw = of.get("vendor") or of.get("source") or of.get("site") or of.get("ota_name") or of.get("name") or "Unknown"
                    v_name = normalize_vendor_name(v_raw)
                    
                    of_cur = of.get("currency") or h_cur
                    p_raw = of.get("price")
                    p_val_extracted = _extract_price(p_raw, currency=of_cur)
                    
                    # AGENT_FIX: Convert offer price to user preference
                    p_val = convert_currency(p_val_extracted, of_cur, display_currency) if p_val_extracted > 0 else 0
                    
                    if p_val and p_val > 0:
                        processed_offers.append({
                            "vendor": v_name,
                            "price": p_val,
                            "currency": display_currency,
                            "url": of.get("url") or of.get("link"),
                            "is_direct": of.get("is_direct", False),
                            "room_type": of.get("room_type") or of.get("room_name") or of.get("room")
                        })

                price_info = {
                    "current_price": curr_p,
                    "previous_price": prev_p,
                    "currency": display_currency,
                    "name": h.get("name"),
                    "trend": "stable",
                    "change_percent": 0.0,
                    "recorded_at": h.get("updated_at") or h.get("created_at"),
                    "vendor": h.get("vendor") or "System",
                    "offers": processed_offers,
                    "room_types": raw_rooms
                }

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
                if sid in directory_map and directory_map[sid].get("sentiment_breakdown"):
                    raw_breakdown = directory_map[sid].get("sentiment_breakdown")
                else:
                    raw_breakdown = recovered_sentiment_map.get(hid) or []
            
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
            reviews_raw = h.get("reviews") or dir_data.get("reviews") or {}
            
            # AGENT_FIX: Explicit Review Mapping for Frontend
            # The UI expects 'other_sites_reviews' at the top level.
            # In DB, it is often nested inside the 'reviews' object.
            other_sites_reviews = h.get("other_sites_reviews") or []
            if not other_sites_reviews and isinstance(reviews_raw, dict):
                other_sites_reviews = reviews_raw.get("other_sites_reviews") or []

            # AGENT_LOGIC: Cross-User Recovery for Rating & Review Count (Pro Fallback)
            if (
                rating is None
                or rating == 0
                or review_count is None
                or review_count == 0
            ) and h.get("serp_api_id"):
                sid = h["serp_api_id"]
                if sid in recovered_ratings_map:
                    rating = rating or recovered_ratings_map[sid].get("rating")
                    review_count = review_count or recovered_ratings_map[sid].get("review_count")

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
                    "reviews": reviews_raw,
                    "other_sites_reviews": other_sites_reviews,
                    "price_info": price_info,
                    "price_history": [
                        {
                            "price": convert_currency(
                                float(p["price"]),
                                p.get("currency") or "USD",
                                display_currency,
                            ),
                            "recorded_at": p.get("recorded_at"),
                            "check_in_date": p.get("check_in_date"),
                        }
                        for p in prices
                        if p.get("price") is not None
                    ][:7],
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
                # AGENT_FIX: Ensure numerical extraction with currency context
                ota_prices = []
                for of in offers:
                    p_raw = of.get("price")
                    if p_raw is not None:
                        p_val = _extract_price(p_raw, currency=price_info.get("currency"))
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
            for prices in hotel_prices_map.values()
            for p in prices
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
