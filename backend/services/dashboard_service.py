"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from supabase import Client

from backend.utils.logger import get_logger
from backend.services.price_comparator import price_comparator
from backend.utils.helpers import convert_currency
from backend.utils.sentiment_utils import normalize_sentiment, generate_mentions, translate_breakdown, synthesize_value_score

logger = get_logger(__name__)

async def get_dashboard_logic(user_id: str, current_user_id: str, current_user_email: str, db: Client) -> Dict[str, Any]:
    """
    Main logic for assembling the dashboard data.
    Performes security checks, fetches hotel data, prices, and scan history.
    
    Optimized: Uses asyncio.gather for parallel database fetching.
    Bundled: Includes user profile and settings for "Fast Load" performance.
    """
    
    # 0. Core Fallback
    fallback_data = {
        "target_hotel": None,
        "competitors": [],
        "recent_searches": [],
        "scan_history": [],
        "recent_sessions": [],
        "unread_alerts_count": 0,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "error": None
    }

    if not db:
        logger.error("Dashboard: Database connection unavailable")
        fallback_data["error"] = "Database Unavailable"
        return fallback_data

    # 1. Security Check: Ownership or Admin
    is_authorized = str(current_user_id) == str(user_id)
    if not is_authorized:
        # Check if current user is admin
        profile_res = db.table("user_profiles").select("role").eq("user_id", str(current_user_id)).limit(1).execute()
        if profile_res.data and profile_res.data[0].get("role") in ["admin", "market_admin", "market admin"]:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Unauthorized access to this dashboard")

    try:
        # [NEW] Parallel Data Fetching for Initial Load
        # We fetch all secondary data concurrently while processing hotels.
        tasks = [
            # 1. User Profile
            asyncio.to_thread(lambda: db.table("user_profiles").select("*").eq("user_id", str(user_id)).single().execute()),
            # 2. User Settings
            asyncio.to_thread(lambda: db.table("settings").select("*").eq("user_id", str(user_id)).single().execute()),
            # 3. Unread Alerts
            asyncio.to_thread(lambda: db.table("alerts").select("id", count="exact").eq("user_id", str(user_id)).eq("is_read", False).execute()),
            # 4. Recent Searches
            asyncio.to_thread(lambda: db.table("query_logs").select("*").eq("user_id", str(user_id)).order("recorded_at", desc=True).limit(20).execute()),
            # 5. Scan History
            asyncio.to_thread(lambda: db.table("price_logs").select("*").eq("user_id", str(user_id)).order("recorded_at", desc=True).limit(10).execute()),
            # 6. Recent Sessions
            asyncio.to_thread(lambda: db.table("scan_sessions").select("*").eq("user_id", str(user_id)).order("created_at", desc=True).limit(5).execute()),
            # 7. Hotels (Bulk Fetch)
            asyncio.to_thread(lambda: db.table("hotels").select("*").eq("user_id", str(user_id)).is_("deleted_at", "null").execute())
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Unpack results safely
        profile_res = results[0] if not isinstance(results[0], Exception) else None
        settings_res = results[1] if not isinstance(results[1], Exception) else None
        alerts_res = results[2] if not isinstance(results[2], Exception) else None
        searches_res = results[3] if not isinstance(results[3], Exception) else None
        history_res = results[4] if not isinstance(results[4], Exception) else None
        sessions_res = results[5] if not isinstance(results[5], Exception) else None
        hotels_res = results[6] if not isinstance(results[6], Exception) else None

        user_profile = profile_res.data if profile_res and hasattr(profile_res, 'data') else {}
        user_settings = settings_res.data if settings_res and hasattr(settings_res, 'data') else {}
        unread_count = alerts_res.count if alerts_res and hasattr(alerts_res, 'count') else 0
        recent_searches_raw = searches_res.data if searches_res and hasattr(searches_res, 'data') else []
        scan_history = history_res.data if history_res and hasattr(history_res, 'data') else []
        recent_sessions = sessions_res.data if sessions_res and hasattr(sessions_res, 'data') else []
        all_hotels = hotels_res.data if hotels_res and hasattr(hotels_res, 'data') else []

        if not all_hotels:
            fallback_data.update({
                "profile": user_profile,
                "user_settings": user_settings,
                "unread_alerts_count": unread_count
            })
            return fallback_data

        # 2. Enrich Hotels with Master Directory data
        serp_ids = list(set(h.get("serp_api_id") for h in all_hotels if h.get("serp_api_id")))
        directory_map = {}
        if serp_ids:
            dir_res = db.table("hotel_directory").select("*").in_("serp_api_id", serp_ids).execute()
            for drecord in (dir_res.data or []):
                directory_map[drecord["serp_api_id"]] = drecord

        # 3. Batch Fetch Price Logs for all hotels
        hotel_ids = [str(h["id"]) for h in all_hotels]
        hotel_prices_map = {}
        all_prices_res = db.table("price_logs") \
            .select("*") \
            .in_("hotel_id", hotel_ids) \
            .order("recorded_at", desc=True) \
            .limit(200) \
            .execute()
        
        for p in (all_prices_res.data or []):
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
            if not token: continue
            
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
                        "room_types": current_log.get("room_types") or []
                    }
                except Exception as e:
                    logger.warning(f"Price processing error: {e}")

            # Sentiment Processing
            raw_breakdown = h.get("sentiment_breakdown") or []
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

            enriched_hotels.append({
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
                "price_info": price_info,
                "price_history": [{"price": float(p["price"]), "recorded_at": p.get("recorded_at")} for p in prices if p.get("price") is not None]
            })

        # 5. Value Synthesis
        market_avg = sum(active_prices) / len(active_prices) if active_prices else 0
        for hotel_data in enriched_hotels:
            sentiment = hotel_data["sentiment_breakdown"]
            value_pillar = next((p for p in sentiment if p["name"] == "Value"), None)
            if value_pillar and value_pillar.get("total_mentioned", 0) == 0:
                price_info = hotel_data["price_info"]
                if price_info and market_avg > 0:
                    ari = (price_info["current_price"] / market_avg) * 100
                    value_pillar.update(synthesize_value_score(ari))

        # 6. Final Aggregation
        target_hotel = next((h for h in enriched_hotels if h.get("is_target_hotel")), None) or (enriched_hotels[0] if enriched_hotels else None)
        competitors = [h for h in enriched_hotels if h != target_hotel]
        
        # Recent Searches Deduplication
        seen_searches = set()
        recent_searches = []
        for s in recent_searches_raw:
            name = s.get("hotel_name")
            if name and name not in seen_searches:
                recent_searches.append(s)
                seen_searches.add(name)
            if len(recent_searches) >= 10: break

        # Calculate Next Scan
        next_scan_at = None
        freq = (user_settings.get("check_frequency_minutes") or 0) if user_settings else 0
        if freq > 0:
            latest = None
            for h in enriched_hotels:
                if h["price_history"]:
                    ts = h["price_history"][0]["recorded_at"]
                    if latest is None or ts > latest: latest = ts
            if latest:
                last_run = datetime.fromisoformat(latest.replace("Z", "+00:00"))
                next_scan_at = (last_run + timedelta(minutes=freq)).isoformat()

        return {
            "target_hotel": target_hotel,
            "competitors": competitors,
            "recent_searches": recent_searches,
            "scan_history": scan_history,
            "recent_sessions": recent_sessions,
            "unread_alerts_count": unread_count,
            "next_scan_at": next_scan_at,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "profile": user_profile,
            "user_settings": user_settings,
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
        res = db.table("alerts") \
            .select("hotel_id, message, old_price, new_price, created_at") \
            .ilike("message", "%Global Pulse%") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        raw_alerts = res.data or []
        if not raw_alerts: return []

        hotel_ids = list(set([a["hotel_id"] for a in raw_alerts]))
        hotels_res = db.table("hotels").select("id, name").in_("id", hotel_ids).execute()
        hotel_name_map = {h["id"]: h["name"] for h in hotels_res.data}

        wins = []
        for a in raw_alerts:
            pct = 0
            if a["old_price"] and a["old_price"] > 0:
                pct = round(((a["old_price"] - a["new_price"]) / a["old_price"]) * 100, 1)

            wins.append({
                "hotel_name": hotel_name_map.get(a["hotel_id"], "A shared hotel"),
                "reduction": f"{pct}%",
                "message": a["message"].replace("[Global Pulse] ", ""),
                "timestamp": a["created_at"]
            })
        return wins
    except Exception as e:
        logger.error(f"get_recent_wins failure: {e}")
        return []
