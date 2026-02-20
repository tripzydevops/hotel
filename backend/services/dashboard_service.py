"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from supabase import Client

from backend.services.price_comparator import price_comparator
from backend.utils.helpers import convert_currency
from backend.utils.sentiment_utils import normalize_sentiment, generate_mentions, translate_breakdown, synthesize_value_score

async def get_dashboard_logic(user_id: str, current_user_id: str, current_user_email: str, db: Client) -> Dict[str, Any]:
    """
    Main logic for assembling the dashboard data.
    Performes security checks, fetches hotel data, prices, and scan history.
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

    # Safety: Handle missing DB connection (e.g. env var misconfiguration)
    if not db:
        logger.error("Dashboard: Database connection unavailable (db is None)")
        fallback_data["error"] = "Database Unavailable"
        return fallback_data

    # 1. Security Check: Ownership or Admin
    is_authorized = str(current_user_id) == str(user_id)
    if not is_authorized:
        # Admin check
        profile = db.table("user_profiles").select("role").eq("user_id", current_user_id).limit(1).execute()
        if profile.data and profile.data[0].get("role") in ["admin", "market_admin", "market admin"]:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Unauthorized access to this dashboard")

    try:
        # 1. Fetch hotels
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        all_hotels = hotels_result.data or []
        
        # EXPLANATION: Master Directory Join
        # Why: Individual user hotels (in 'hotels' table) are often added via search 
        # and may lack rich metadata like image_urls or star ratings.
        # How: We perform a bulk join with the 3,670-entry 'hotel_directory' table
        # using 'serp_api_id'. This backfills the UI with premium metadata from our
        # master database, ensuring a high-quality display even for newly tracked hotels.
        enriched_hotels = []
        serp_ids = [h.get("serp_api_id") for h in all_hotels if h.get("serp_api_id")]
        
        directory_map = {}
        if serp_ids:
            dir_res = db.table("hotel_directory").select("*").in_("serp_api_id", serp_ids).execute()
            for drecord in (dir_res.data or []):
                directory_map[drecord["serp_api_id"]] = drecord
        
        for h in all_hotels:
            token = h.get("property_token") or h.get("serp_api_id")
            if not token: continue # Skip untracked hotels
            
            # Merge directory data if available
            dir_data = directory_map.get(h.get("serp_api_id"), {})
            enriched = {
                **dir_data, # Use directory as base (images, rating, etc)
                **h,        # Override with user-specific data (name preferred, currency)
            }
            enriched_hotels.append(enriched)

        hotels = enriched_hotels
        
        if not hotels:
            return fallback_data

        # 1.1 BATCH FETCH Price Logs
        hotel_ids = [str(h["id"]) for h in hotels]
        hotel_names = [h["name"] for h in hotels]
        hotel_prices_map = {}
        try:
            # EXPLANATION: Single-Source Price Fetch (Legacy Cleanup)
            # Previously also fetched from 'query_logs' (legacy audit table) for
            # historical depth. Now uses only 'price_logs' as the canonical source.
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
        except Exception as e:
            logger.error(f"Batch price fetch failed: {e}")

        target_hotel = None
        competitors = []

        # KAİZEN: Market Average for Synthesis
        # We calculate the avg price across all tracked hotels to enable ARI synthesis
        # for hotels missing direct 'Value' sentiment data.
        active_prices = []
        for hid, p_logs in hotel_prices_map.items():
            if p_logs and p_logs[0].get("price"):
                active_prices.append(float(p_logs[0]["price"]))
        
        market_avg_global = sum(active_prices) / len(active_prices) if active_prices else 0
        
        for hotel in hotels:
            hid = str(hotel["id"])
            prices = hotel_prices_map.get(hid, [])
            current_price_log = prices[0] if prices else None
            previous_price_log = prices[1] if len(prices) > 1 else None
            
            price_info = None
            if current_price_log and current_price_log.get("price") is not None:
                try:
                    current = float(current_price_log["price"])
                    curr_currency = current_price_log.get("currency") or "USD"
                    
                    previous = None
                    if previous_price_log and previous_price_log.get("price") is not None:
                        raw_prev = float(previous_price_log["price"])
                        prev_currency = previous_price_log.get("currency") or "USD"
                        previous = convert_currency(raw_prev, prev_currency, curr_currency)
                    
                    trend_obj, change = price_comparator.calculate_trend(current, previous)
                    trend_val = str(getattr(trend_obj, "value", trend_obj))

                    price_info = {
                        "current_price": current,
                        "previous_price": previous,
                        "currency": curr_currency,
                        "trend": trend_val,
                        "change_percent": change,
                        "recorded_at": current_price_log.get("recorded_at"),
                        "vendor": current_price_log.get("vendor"),
                        "check_in": current_price_log.get("check_in_date"),
                        "check_out": current_price_log.get("check_out_date"),
                        "adults": current_price_log.get("adults"),
                        "offers": current_price_log.get("parity_offers") or current_price_log.get("offers") or [],
                        "room_types": current_price_log.get("room_types") or [],
                        "search_rank": current_price_log.get("search_rank")
                    }
                except Exception as e:
                    logger.warning(f"Error building price_info for {hotel.get('name')}: {e}")

            valid_history = []
            for p in prices:
                if p.get("price") is not None:
                    valid_history.append({
                        "price": float(p["price"]), 
                        "recorded_at": p.get("recorded_at")
                    })

            # EXPLANATION: Unified Sentiment Normalization
            # We apply the centralized normalization to ensure that 
            # hotel cards show the 4 core pillars even if the source 
            # uses localized Turkish terms.
            # KAİZEN: Standardized Sentiment & Deep Dive
            raw_breakdown = hotel.get("sentiment_breakdown") or []
            item_sentiment = normalize_sentiment(raw_breakdown)
            item_raw_breakdown = translate_breakdown(raw_breakdown)
            item_mentions = hotel.get("guest_mentions") or generate_mentions(raw_breakdown)

            # KAİZEN: Value Synthesis for Dashboard
            # Ensure the dashboard radar chart/pillars have data even if raw is sparse
            value_pillar = next((p for p in item_sentiment if p["name"] == "Value"), None)
            
            # Calculate market_avg_global after all active_prices are collected
            # This will be done after the loop, then we'll re-process value_pillar if needed.
            
            enriched_hotels.append({
                **enriched,
                "sentiment_breakdown": item_sentiment,
                "sentiment_raw_breakdown": item_raw_breakdown,
                "guest_mentions": item_mentions,
                "price_info": price_info,
                "price_history": valid_history
            })

        # KAİZEN: Market Average for Synthesis
        # We calculate the avg price across all tracked hotels to enable ARI synthesis
        # for hotels missing direct 'Value' sentiment data.
        market_avg_global = sum(active_prices) / len(active_prices) if active_prices else 0

        # Re-process value pillar for synthesis now that market_avg_global is available
        for hotel_data in enriched_hotels:
            item_sentiment = hotel_data["sentiment_breakdown"]
            value_pillar = next((p for p in item_sentiment if p["name"] == "Value"), None)
            if value_pillar and value_pillar.get("total_mentioned", 0) == 0:
                # Calc ARI if target or compared
                curr_price = hotel_data["price_info"]["current_price"] if hotel_data["price_info"] else None
                if curr_price and market_avg_global > 0:
                    ari_val = (curr_price / market_avg_global) * 100
                    syn_val = synthesize_value_score(ari_val)
                    value_pillar.update(syn_val)
        
        # 4. Final Aggregation
        target_hotel = next((h for h in enriched_hotels if h.get("is_target_hotel")), None)
        if not target_hotel and enriched_hotels:
            # Fallback: If no target hotel is explicitly selected, use the first one.
            # This prevents the "No Data" screen for users who have hotels but lost the selection state.
            target_hotel = enriched_hotels[0]
        
        competitors = [h for h in enriched_hotels if h != target_hotel]
        
        # Deduplicate recent searches
        seen_names = set()
        recent_searches = []
        for log in recent_searches_raw:
            name = log.get("hotel_name")
            if name and name not in seen_names:
                recent_searches.append(log)
                seen_names.add(name)
            if len(recent_searches) >= 10: break

        # Calculate next scan
        next_scan_at = None
        freq = (user_settings.get("check_frequency_minutes") or 0) if user_settings else 0
        if freq > 0 and hotel_ids:
            # Find the latest recorded_at from all price histories
            latest_recorded_at = None
            for hotel_data in enriched_hotels:
                if hotel_data["price_history"]:
                    # Price history is already sorted by recorded_at desc in the map, so first is latest
                    current_latest = hotel_data["price_history"][0]["recorded_at"]
                    if latest_recorded_at is None or current_latest > latest_recorded_at:
                        latest_recorded_at = current_latest
            
            if latest_recorded_at:
                last_run = datetime.fromisoformat(latest_recorded_at.replace("Z", "+00:00"))
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
            "scheduled_status": "Calculating next scan based on last manual or scheduled update.",
            "profile": user_profile,
            "user_settings": user_settings,
        }

    except Exception as e:
        logger.critical(f"DASHBOARD ERROR: {e}")
        # Return fallback data instead of crashing 500. This empowers the user to fix config.
        fallback_data["error"] = str(e)
        return fallback_data


import time

_RECENT_WINS_CACHE = {"data": [], "timestamp": 0}
_CACHE_TTL = 300  # 5 minutes

async def get_recent_wins(db: Client, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetches anonymized recent price drops discovered by the Global Pulse network.
    Cached for 5 minutes to reduce DB load.
    """
    global _RECENT_WINS_CACHE
    if time.time() - _RECENT_WINS_CACHE["timestamp"] < _CACHE_TTL:
        return _RECENT_WINS_CACHE["data"]

    try:
        # Fetch recent alerts with "[Global Pulse]" in the message
        # We also need the hotel names from the hotel directory or the hotels table
        # anonymized: we don't show user_ids
        res = db.table("alerts") \
            .select("hotel_id, message, old_price, new_price, created_at") \
            .ilike("message", "%Global Pulse%") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        raw_alerts = res.data or []
        if not raw_alerts:
            return []

        # Fetch hotel names for these alerts
        hotel_ids = list(set([a["hotel_id"] for a in raw_alerts]))
        hotels_res = db.table("hotels").select("id, name").in_("id", hotel_ids).execute()
        hotel_name_map = {h["id"]: h["name"] for h in hotels_res.data}

        wins = []
        for a in raw_alerts:
            name = hotel_name_map.get(a["hotel_id"], "A shared hotel")
            
            # Extract percentage from message if possible, or calculate
            pct_change = 0
            if a["old_price"] and a["old_price"] > 0:
                pct_change = round(((a["old_price"] - a["new_price"]) / a["old_price"]) * 100, 1)

            wins.append({
                "hotel_name": name,
                "reduction": f"{pct_change}%",
                "message": a["message"].replace("[Global Pulse] ", ""),
                "timestamp": a["created_at"]
            })
        
        _RECENT_WINS_CACHE = {"data": wins, "timestamp": time.time()}
        return wins
    except Exception as e:
        logger.error(f"get_recent_wins failure: {e}")
        return []
