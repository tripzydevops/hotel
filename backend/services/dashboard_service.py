"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""

import asyncio
from datetime import datetime, timedelta, timezone
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
            "market_offers, parity_offers, offers, min_price_floor)"
        )
        .eq("user_id", uid)
        .execute()
    )


# ─── Phase-2 Query Helpers (depend on hotel data from Phase-1) ───────────────

def _fetch_scan_history(db: Client, hotel_ids: list):
    return db.table("price_logs").select("*").in_("hotel_id", hotel_ids).order("recorded_at", desc=True).limit(10).execute()

def _fetch_directory(db: Client, serp_ids: list):
    return db.table("hotel_directory").select("*").in_("serp_api_id", serp_ids).execute()


def extract_vendor_name(offer: Dict[str, Any]) -> str:
    """
    Extracts the vendor/OTA name from an offer dict, trying multiple field names in priority order.
    Centralizes the repeated vendor resolution chain across all offer-processing loops.
    """
    for key in ("vendor", "source", "site", "ota_name", "name"):
        val = offer.get(key)
        if val and isinstance(val, str) and val.strip():
            return val.strip()
    return "Unknown"



def is_standard_room_type(room_name: str) -> bool:
    """
    Classifies if a room is standard based on keyword checks.
    Synchronized with room category normalization.
    """
    if not room_name:
        return True
    
    # Standard keywords matching frontend standardKeywords
    standard_keywords = [
        "standard", "standart", "economy", "ekonomik", "promo",
        "base", "classic", "klasik", "double", "twin", "single",
        "tek", "çift", "roh", "run of house", "basic", "budget", 
        "promotion", "promotional", "run of the house"
    ]
    
    # Premium keywords that should be excluded
    premium_keywords = [
        "suite", "süit", "deluxe", "delüks", "superior", "süperior",
        "premium", "family", "aile", "executive", "club", "villa",
        "penthouse", "presidential", "kral", "royal", "duplex", "loft",
        "studio", "apart", "apartment", "aprt"
    ]
    
    lower_name = room_name.lower()
    
    # If it contains any premium keyword, it's NOT a standard room
    if any(k in lower_name for k in premium_keywords):
        return False
        
    # If it contains any standard keyword or has no premium keywords, it's a standard room
    return any(k in lower_name for k in standard_keywords) or not any(k in lower_name for k in premium_keywords)



async def _verify_dashboard_access(user_id: str, current_user_id: str, db: Client) -> bool:
    is_authorized = current_user_id == user_id
    if not is_authorized:
        profile_res = (
            db.table("user_profiles")
            .select("role")
            .eq("user_id", current_user_id)
            .limit(1)
            .execute()
        )
        if (
            profile_res 
            and hasattr(profile_res, "data") 
            and profile_res.data 
            and isinstance(profile_res.data, list) 
            and len(profile_res.data) > 0 
            and isinstance(profile_res.data[0], dict) 
            and profile_res.data[0].get("role") in [
            "admin",
            "market_admin",
            "market admin",
        ]):
            is_authorized = True
    return is_authorized

async def _fetch_user_metadata_concurrently(user_id: str, db: Client):
    (
        profile_res,
        settings_res,
        alerts_res,
        searches_res,
        sessions_res,
        active_scans_res,
        hotels_res,
    ) = await asyncio.gather(
        asyncio.to_thread(_fetch_profile, db, user_id),
        asyncio.to_thread(_fetch_settings, db, user_id),
        asyncio.to_thread(_fetch_unread_alerts, db, user_id),
        asyncio.to_thread(_fetch_recent_searches, db, user_id),
        asyncio.to_thread(_fetch_sessions, db, user_id),
        asyncio.to_thread(_fetch_active_scans, db, user_id),
        asyncio.to_thread(_fetch_user_hotels, db, user_id),
    )
    return profile_res, settings_res, alerts_res, searches_res, sessions_res, active_scans_res, hotels_res

async def _build_directory_map(all_hotels: list, db: Client) -> dict:
    serp_ids = list(set(h.get("serp_api_id") for h in all_hotels if h.get("serp_api_id")))
    directory_map = {}
    if serp_ids:
        dir_res = db.table("hotel_directory").select("*").in_("serp_api_id", serp_ids).execute()
        for drecord in dir_res.data or []:
            if isinstance(drecord, dict):
                sid = drecord.get("serp_api_id")
                if sid is not None:
                    directory_map[sid] = drecord
    return directory_map

async def _fetch_and_filter_prices(hotel_ids: list, all_hotels: list, db: Client) -> dict:
    hotel_prices_map = {}
    try:
        async def fetch_hotel_prices(hid):
            def _fetch_rich(h_id):
                return (
                    db.table("price_logs")
                    .select("id, hotel_id, price, currency, room_types, offers, parity_offers, market_offers, recorded_at, check_in_date, scan_sessions(adults, check_out_date)")
                    .eq("hotel_id", h_id)
                    .order("recorded_at", desc=True)
                    .limit(5)
                    .execute()
                )
            
            def _fetch_trend_live(h_id):
                seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                return (
                    db.table("price_logs")
                    .select("id, hotel_id, price, currency, recorded_at, check_in_date")
                    .eq("hotel_id", h_id)
                    .gte("recorded_at", seven_days_ago)
                    .order("recorded_at", desc=True)
                    .execute()
                )

            def _fetch_trend_historical(h_id):
                seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
                return (
                    db.table("price_history_daily")
                    .select("hotel_id, date, avg_price, min_price, max_price, top_vendor")
                    .eq("hotel_id", h_id)
                    .lt("date", seven_days_ago)
                    .order("date", desc=True)
                    .limit(20)
                    .execute()
                )
            
            rich_res, live_res, hist_res = await asyncio.gather(
                asyncio.to_thread(_fetch_rich, hid),
                asyncio.to_thread(_fetch_trend_live, hid),
                asyncio.to_thread(_fetch_trend_historical, hid),
            )
            
            rich_logs = getattr(rich_res, "data", []) or []
            live_logs = getattr(live_res, "data", []) or []
            hist_logs = getattr(hist_res, "data", []) or []
            
            normalized_hist = []
            for h_row in hist_logs:
                normalized_hist.append({
                    "id": f"rollup_{h_row.get('hotel_id')}_{h_row.get('date')}",
                    "hotel_id": h_row.get("hotel_id"),
                    "price": h_row.get("avg_price"),
                    "currency": "TRY",
                    "recorded_at": h_row.get("date"),
                    "check_in_date": h_row.get("date"),
                    "vendor": h_row.get("top_vendor"),
                    "_source": "rollup",
                })
            
            rich_ids = {str(log.get("id")) for log in rich_logs if log.get("id")}
            combined = list(rich_logs)
            for log in live_logs:
                lid = str(log.get("id"))
                if lid not in rich_ids:
                    combined.append(log)
                    rich_ids.add(lid)
            combined.extend(normalized_hist)
            return hid, combined[:30]

        tasks = [fetch_hotel_prices(hid) for hid in hotel_ids]
        results = await asyncio.gather(*tasks)
        hotel_prices_map = dict(results)
        
        for hid, logs in hotel_prices_map.items():
            if not logs or not isinstance(logs, list): continue
            hotel_meta = next((h for h in all_hotels if isinstance(h, dict) and str(h.get("id")) == str(hid)), {})
            floor = float(hotel_meta.get("min_price_floor") or 0)
            
            filtered_logs = []
            for log in logs:
                price_val = float(log.get("price") or 0)
                log_currency = str(log.get("currency") or "TRY").upper()
                price_in_try = convert_currency(price_val, log_currency, "TRY") if log_currency != "TRY" else price_val
                if price_in_try >= max(floor, 100.0):
                    filtered_logs.append(log)
            hotel_prices_map[hid] = filtered_logs
    except Exception as e:
        logger.error(f"[Dashboard] Parallel split-query price fetch failed: {e}")
        hotel_prices_map = {hid: [] for hid in hotel_ids}
    return hotel_prices_map

async def _recover_missing_reputation_data(all_hotels: list, directory_map: dict, db: Client) -> tuple:
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
            rows = getattr(sh_res, "data", []) or []
            for row in rows:
                if not isinstance(row, dict): continue
                hid = str(row.get("hotel_id"))
                if hid and hid not in recovered_sentiment_map:
                    recovered_sentiment_map[hid] = row.get("sentiment_breakdown") or []
        except Exception as e:
            logger.error(f"[GlobalPulse/Dashboard] Batch sentiment recovery failed: {e}")

    recovered_ratings_map = {}
    if missing_rating_sids:
        def _fetch_missing_ratings(sids):
            return db.table("hotels").select("id, serp_api_id, rating, review_count").in_("serp_api_id", sids).execute()
        try:
            g_res = await asyncio.to_thread(_fetch_missing_ratings, missing_rating_sids)
            gh_rows = getattr(g_res, "data", []) or []
            for gh in gh_rows:
                if not isinstance(gh, dict): continue
                sid = gh.get("serp_api_id")
                if not sid: continue
                if sid not in recovered_ratings_map:
                    recovered_ratings_map[sid] = {"rating": None, "review_count": None, "hids": []}
                
                gh_id = gh.get("id")
                if gh_id is not None:
                    recovered_ratings_map[sid]["hids"].append(str(gh_id))
                
                gh_rc = gh.get("review_count")
                if gh_rc and isinstance(gh_rc, (int, float)) and gh_rc > 0 and not recovered_ratings_map[sid]["review_count"]:
                    recovered_ratings_map[sid]["review_count"] = gh_rc
                
                gh_r = gh.get("rating")
                if gh_r and isinstance(gh_r, (int, float)) and gh_r > 0 and not recovered_ratings_map[sid]["rating"]:
                    recovered_ratings_map[sid]["rating"] = gh_r
            
            sids_still_missing = [sid for sid, d in recovered_ratings_map.items() if not d["review_count"]]
            if sids_still_missing:
                all_hids_recovery = []
                for sid in sids_still_missing:
                    all_hids_recovery.extend(recovered_ratings_map[sid]["hids"])
                if all_hids_recovery:
                    def _fetch_sh_ratings(hids):
                        return db.table("sentiment_history").select("hotel_id, rating, review_count").in_("hotel_id", hids).order("recorded_at", desc=True).execute()
                    sh_res = await asyncio.to_thread(_fetch_sh_ratings, all_hids_recovery)
                    rows_sh = getattr(sh_res, "data", []) or []
                    for row in rows_sh:
                        if not isinstance(row, dict): continue
                        hid = str(row.get("hotel_id"))
                        if not hid: continue
                        for sid, d in recovered_ratings_map.items():
                            if hid in d.get("hids", []):
                                if row.get("review_count") and not d.get("review_count"):
                                    d["review_count"] = row.get("review_count")
                                if row.get("rating") and not d.get("rating"):
                                    d["rating"] = row.get("rating")
                                break
        except Exception as e:
            logger.error(f"[GlobalPulse/Dashboard] Batch rating recovery failed: {e}")
            
    return recovered_sentiment_map, recovered_ratings_map

def _process_hotel_prices(h: dict, hid: str, prices: list, display_currency: str) -> tuple:
    current_log = prices[0] if prices else None
    prev_log = None
    price_info = None
    active_price = None

    if current_log:
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
            target_room = h.get("room_type_standard") or "Standard"
            curr_c = current_log.get("currency") or "TRY"
            curr_p_raw, matched_name, confidence = get_price_for_room(
                current_log, target_room, {}, currency=curr_c
            )
            
            curr_p = None
            if curr_p_raw is not None and curr_p_raw > 0:
                curr_p = convert_currency(curr_p_raw, curr_c, display_currency)
                active_price = curr_p

            prev_p = None
            if prev_log:
                prev_c = prev_log.get("currency") or "TRY"
                p_val_prev, _, _ = get_price_for_room(
                    prev_log, target_room, {}, currency=prev_c
                )
                if p_val_prev is not None and p_val_prev > 0:
                    prev_p = convert_currency(p_val_prev, prev_c, display_currency)

            if curr_p is not None and curr_p > 0 and prev_p is not None and prev_p > 0:
                trend_obj, change = price_comparator.calculate_trend(curr_p, prev_p)
                trend_val = str(getattr(trend_obj, "value", trend_obj))
            else:
                trend_val = "stable"
                change = 0.0

            active_currency = current_log.get("currency") or display_currency or "TRY"
            
            raw_rooms = []
            seen_room_keys = set()
            for p_log in prices:
                if p_log.get("room_types"):
                    for rt in p_log["room_types"]:
                        if not isinstance(rt, dict) or not rt.get("name"): continue
                        r_key = f"{rt.get('name')}_{rt.get('price')}_{rt.get('source', '')}".strip().lower()
                        if r_key not in seen_room_keys:
                            raw_rooms.append(rt)
                            seen_room_keys.add(r_key)
                    if raw_rooms: break
            
            if not raw_rooms and h.get("room_types"):
                for rt in h["room_types"]:
                    if not isinstance(rt, dict) or not rt.get("name"): continue
                    r_key = f"{rt.get('name')}_{rt.get('price')}_{rt.get('source', '')}".strip().lower()
                    if r_key not in seen_room_keys:
                        raw_rooms.append(rt)
                        seen_room_keys.add(r_key)

            raw_offers = []
            seen_offers_global = set()
            seen_offer_keys_global = set()
            
            for p_log in prices:
                log_offers = []
                seen_in_log = set()
                
                for key in ["offers", "ota_prices", "parity_offers", "market_offers"]:
                    val = p_log.get(key)
                    if val and isinstance(val, list):
                        for of in val:
                            if not isinstance(of, dict): continue
                            v_norm = normalize_vendor_name(extract_vendor_name(of))
                            price = _extract_price(of.get("price"))
                            inner_key = f"{v_norm}_{price}".lower().strip()
                            if inner_key not in seen_in_log:
                                seen_in_log.add(inner_key)
                                log_offers.append(of)
                
                for of in log_offers:
                    v_norm = normalize_vendor_name(extract_vendor_name(of))
                    price = _extract_price(of.get("price"))
                    offer_key = f"{v_norm}_{price}".lower().strip()
                    
                    if v_norm not in seen_offers_global and offer_key not in seen_offer_keys_global:
                        raw_offers.append(of)
                        seen_offer_keys_global.add(offer_key)
                
                for of in log_offers:
                    seen_offers_global.add(normalize_vendor_name(extract_vendor_name(of)))

            for key in ["market_offers", "parity_offers", "offers"]:
                val = h.get(key)
                if val and isinstance(val, list):
                    for of in val:
                        if not isinstance(of, dict): continue
                        v_norm = normalize_vendor_name(extract_vendor_name(of))
                        price = _extract_price(of.get("price"))
                        offer_key = f"{v_norm}_{price}".lower().strip()
                        
                        if v_norm not in seen_offers_global and offer_key not in seen_offer_keys_global:
                            raw_offers.append(of)
                            seen_offer_keys_global.add(offer_key)
                            seen_offers_global.add(v_norm)

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
                if not isinstance(of, dict): continue
                room_name = of.get("room_type") or of.get("room_name") or of.get("room") or ""
                if not is_standard_room_type(room_name): continue
                
                v_name = normalize_vendor_name(extract_vendor_name(of))
                of_cur = of.get("currency") or active_currency
                p_raw = of.get("price")
                p_val_extracted = _extract_price(p_raw, currency=of_cur)
                p_val = convert_currency(p_val_extracted, of_cur, display_currency) if p_val_extracted and p_val_extracted > 0 else 0
                
                if p_val is None or p_val <= 0: continue
                processed_offers.append({
                    "vendor": v_name,
                    "price": p_val,
                    "currency": display_currency,
                    "url": of.get("url") or of.get("link"),
                    "is_direct": of.get("is_direct", False),
                    "room_type": of.get("room_type") or of.get("room_name") or of.get("room")
                })

            processed_rooms = []
            for rt in raw_rooms:
                if not isinstance(rt, dict): continue
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

    if not price_info:
        curr_p_raw = h.get("price") or h.get("current_price") or 0
        prev_p_raw = h.get("previous_price") or curr_p_raw
        h_cur = h.get("currency") or "TRY"
        curr_p = convert_currency(curr_p_raw, h_cur, display_currency)
        prev_p = convert_currency(prev_p_raw, h_cur, display_currency)
        active_price = curr_p
        
        raw_rooms = h.get("room_types") or []
        raw_offers = []
        for key in ["market_offers", "parity_offers", "offers"]:
            val = h.get(key)
            if val and isinstance(val, list) and len(val) > 0:
                raw_offers = val
                break
        
        processed_offers = []
        for of in raw_offers:
            if not isinstance(of, dict): continue
            room_name = of.get("room_type") or of.get("room_name") or of.get("room") or ""
            if not is_standard_room_type(room_name): continue
                
            v_name = normalize_vendor_name(extract_vendor_name(of))
            of_cur = of.get("currency") or h_cur
            p_raw = of.get("price")
            p_val_extracted = _extract_price(p_raw, currency=of_cur)
            p_val = convert_currency(p_val_extracted, of_cur, display_currency) if (p_val_extracted is not None and p_val_extracted > 0) else 0
            
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
        
    return price_info, active_price

async def get_dashboard_logic(
    user_id: str, current_user_id: str, current_user_email: str, db: Client
) -> Dict[str, Any]:
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

    is_authorized = await _verify_dashboard_access(user_id, current_user_id, db)
    if not is_authorized:
        raise HTTPException(
            status_code=403, detail="Unauthorized access to this dashboard"
        )

    try:
        fallback_data.update({
            "active_scans": 0,
            "market_insight": "Market data is currently being synchronized...",
        })

        (
            profile_res,
            settings_res,
            alerts_res,
            searches_res,
            sessions_res,
            active_scans_res,
            hotels_res,
        ) = await _fetch_user_metadata_concurrently(user_id, db)

        active_scans_count = active_scans_res.count if active_scans_res and hasattr(active_scans_res, "count") else 0

        all_associations = getattr(hotels_res, "data", []) or []
        all_hotels = []
        for assoc in all_associations:
            if not isinstance(assoc, dict): continue
            hotel = assoc.get("hotel")
            if hotel and isinstance(hotel, dict) and not hotel.get("deleted_at"):
                hotel["user_id"] = assoc.get("user_id")
                hotel["is_target_hotel"] = assoc.get("is_target", False)
                hotel["is_monitored"] = assoc.get("is_monitored", True)
                hotel["pricing_dna"] = assoc.get("pricing_dna")
                hotel["preferred_currency"] = assoc.get("preferred_currency", "TRY")
                hotel["fixed_check_in"] = assoc.get("fixed_check_in")
                hotel["fixed_check_out"] = assoc.get("fixed_check_out")
                hotel["default_adults"] = assoc.get("default_adults", 2)
                all_hotels.append(hotel)

        user_profile = getattr(profile_res, "data", {}) or {}
        user_settings = getattr(settings_res, "data", {}) or {}

        if isinstance(user_profile, list) and len(user_profile) > 0: user_profile = user_profile[0]
        if not isinstance(user_profile, dict): user_profile = {}

        if isinstance(user_settings, list) and len(user_settings) > 0: user_settings = user_settings[0]
        if not isinstance(user_settings, dict): user_settings = {}

        display_currency = user_settings.get("currency", "TRY") if user_settings else "TRY"
        unread_count = getattr(alerts_res, "count", 0) or 0
        recent_searches_raw = getattr(searches_res, "data", []) or []
        recent_sessions = getattr(sessions_res, "data", []) or []

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

        if not all_hotels:
            logger.info(f"Dashboard: No hotels found for {user_id}, returning metadata only.")
            fallback_data["profile"] = user_profile
            fallback_data["user_settings"] = user_settings
            fallback_data["unread_alerts_count"] = unread_count
            fallback_data["recent_searches"] = []
            fallback_data["recent_sessions"] = recent_sessions
            fallback_data["scan_history"] = []
            return fallback_data

        directory_map = await _build_directory_map(all_hotels, db)
        
        hotel_ids = [str(h.get("id")) for h in all_hotels if isinstance(h, dict) and h.get("id") is not None]
        hotel_prices_map = await _fetch_and_filter_prices(hotel_ids, all_hotels, db, display_currency)

        recovered_sentiment_map, recovered_ratings_map = await _recover_missing_reputation_data(all_hotels, directory_map, db)

        enriched_hotels = []
        active_prices = []
        for h in all_hotels:
            if not isinstance(h, dict): continue
            hid = str(h.get("id"))
            token = h.get("serp_api_id") or h.get("property_token")
            if not token:
                logger.info(f"Dashboard Service: Hotel {h.get('name')} (ID: {hid}) has no token yet. Showing as pending.")

            dir_data = directory_map.get(h.get("serp_api_id"), {})
            prices = hotel_prices_map.get(hid, [])

            price_info, active_price = _process_hotel_prices(h, hid, prices, display_currency)
            if active_price is not None:
                active_prices.append(active_price)

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

            review_count = h.get("review_count") or dir_data.get("review_count")
            rating = h.get("rating") or dir_data.get("rating")
            stars = h.get("stars") or dir_data.get("stars")
            image_url = h.get("image_url") or dir_data.get("image_url")
            latitude = h.get("latitude") or dir_data.get("latitude")
            longitude = h.get("longitude") or dir_data.get("longitude")
            amenities = h.get("amenities") or dir_data.get("amenities") or []
            images = h.get("images") or dir_data.get("images") or []
            reviews_raw = h.get("reviews") or dir_data.get("reviews") or {}
            
            other_sites_reviews = h.get("other_sites_reviews") or []
            if not other_sites_reviews and isinstance(reviews_raw, dict):
                other_sites_reviews = reviews_raw.get("other_sites_reviews") or []

            if (rating is None or rating == 0 or review_count is None or review_count == 0) and h.get("serp_api_id"):
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
                    "guest_mentions": h.get("guest_mentions") or generate_mentions(raw_breakdown),
                    "amenities": amenities,
                    "images": images,
                    "reviews": reviews_raw,
                    "other_sites_reviews": other_sites_reviews,
                    "price_info": price_info,
                    "price_history": [
                        {
                            "price": convert_currency(float(p.get("price") or 0), p.get("currency") or "USD", display_currency),
                            "recorded_at": p.get("recorded_at"),
                            "check_in_date": p.get("check_in_date"),
                        }
                        for p in prices if p.get("price") is not None
                    ][:7],
                }
            )

        market_avg: float = sum(active_prices) / len(active_prices) if active_prices else 0.0
        market_avg_rating = (sum(float(h.get("rating") or 0) for h in enriched_hotels) / len(enriched_hotels) if enriched_hotels else 0)
        
        for hotel_data in enriched_hotels:
            sentiment = hotel_data["sentiment_breakdown"]
            value_pillar = next((p for p in sentiment if p["name"] == "Value"), None)
            if value_pillar and value_pillar.get("total_mentioned", 0) == 0:
                price_info = hotel_data["price_info"]
                if (price_info and price_info.get("current_price") is not None and isinstance(market_avg, (int, float)) and market_avg > 0):
                    ari = (price_info["current_price"] / market_avg) * 100
                    value_pillar.update(synthesize_value_score(ari))

            if sentiment:
                valid_pillars = [p.get("rating") for p in sentiment if isinstance(p, dict) and p.get("rating") is not None]
                if valid_pillars:
                    hotel_data["overall_sentiment_score"] = round(sum(valid_pillars) / len(valid_pillars), 1)
                else:
                    hotel_data["overall_sentiment_score"] = 0.0

            price_info = hotel_data.get("price_info")
            target_room = hotel_data.get("room_type_standard") or "Standard"
            
            standard_keys = ["standard", "standart", "economy", "ekonomik", "base", "classic"]
            is_standard_tracking = any(k in target_room.lower() for k in standard_keys) or target_room == "Standard"

            if (is_standard_tracking and price_info and price_info.get("current_price") and price_info.get("offers")):
                target_price = price_info["current_price"]
                offers = price_info["offers"]

                ota_prices = []
                for of in offers:
                    p_raw = of.get("price")
                    if p_raw is not None:
                        p_val = _extract_price(p_raw, currency=price_info.get("currency"))
                        if p_val and p_val > 0:
                            ota_prices.append(p_val)

                if ota_prices:
                    cheapest_ota = min(ota_prices)
                    if target_price <= cheapest_ota:
                        hotel_data["parity_score"] = 100
                    else:
                        diff_percent = ((target_price - cheapest_ota) / cheapest_ota) * 100
                        hotel_data["parity_score"] = max(0, int(100 - diff_percent))
                else:
                    hotel_data["parity_score"] = 100
            else:
                hotel_data["parity_score"] = 100 if is_standard_tracking else None

        target_hotel = next((h for h in enriched_hotels if h.get("is_target_hotel")), None) or (enriched_hotels[0] if enriched_hotels else None)
        competitors = [h for h in enriched_hotels if h != target_hotel]

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

        synthetic_narrative = "No strategic narrative available yet. Run a scan to generate AI insights."
        comp_limit = 5
        if target_hotel and market_avg > 0:
            try:
                target_price = target_hotel.get("price_info", {}).get("current_price")
                if target_price and market_avg > 0 and market_avg_rating > 0:
                    ari = (target_price / market_avg) * 100
                    target_rating = float(target_hotel.get("rating") or 0.0)
                    sent_index = (target_rating / market_avg_rating) * 100

                    synthetic_narrative = generate_synthetic_narrative(
                        ari=ari,
                        sent_index=sent_index,
                        dna_text=target_hotel.get("pricing_dna_text"),
                        hotel_name=target_hotel.get("name"),
                    )
            except Exception as e:
                logger.warning(f"Narrative generation failed: {e}")

        sync_times = [
            p.get("recorded_at")
            for prices in hotel_prices_map.values()
            for p in prices
            if p.get("recorded_at")
        ]
        last_sync = max(sync_times) if sync_times else datetime.now(timezone.utc).isoformat()

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
                "avg_rating": float(target_hotel.get("overall_sentiment_score") or 0.0) if target_hotel else 0.0,
                "rate_parity_score": int(target_hotel.get("parity_score") or 0) if target_hotel else 0,
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

        raw_alerts = getattr(res, "data", []) or []
        if not raw_alerts:
            return []

        hotel_ids = list(set([str(a.get("hotel_id")) for a in raw_alerts if isinstance(a, dict) and a.get("hotel_id")]))
        res = (
            db.table("hotels")
            .select("id, name, deleted_at")
            .in_("id", hotel_ids)
            .execute()
        )
        # AGENT_LOGIC: Programmatic filtering (Robust)
        hotels_data = [h for h in (getattr(res, "data", []) or []) if isinstance(h, dict) and not h.get("deleted_at")]
        hotel_name_map = {str(h.get("id")): h.get("name", "Unknown") for h in hotels_data if isinstance(h, dict) and h.get("id")}

        wins = []
        for a in raw_alerts:
            if not isinstance(a, dict):
                continue
            pct = 0.0
            old_p = a.get("old_price")
            new_p = a.get("new_price")
            if isinstance(old_p, (int, float)) and old_p > 0 and isinstance(new_p, (int, float)):
                # Calculate change percentage based on price shift
                # This works for both price drops and parity breaches (using direct/OTA prices)
                if old_p > new_p:
                    pct = round(
                        ((old_p - new_p) / old_p) * 100, 1
                    )
                else:
                    # In case of increases or complex shifts, just show absolute difference pct
                    pct = round(
                        (abs(old_p - new_p) / old_p) * 100, 1
                    )

            hid_key = str(a.get("hotel_id"))
            msg_raw = a.get("message", "") or ""
            
            wins.append(
                {
                    "hotel_name": hotel_name_map.get(hid_key, "A shared hotel"),
                    "reduction": f"{pct}%",
                    "message": msg_raw.replace("Global Pulse: ", ""),
                    "timestamp": a.get("created_at"),
                }
            )
        return wins
    except Exception as e:
        logger.error(f"get_recent_wins failure: {e}")
        return []
