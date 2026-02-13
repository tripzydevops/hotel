"""
Dashboard Service.
Aggregates hotel data, pricing history, alerts, and scan status for the user cockpit.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from supabase import Client

from backend.services.price_comparator import price_comparator
from backend.utils.helpers import convert_currency

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
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

    # 1. Security Check: Ownership or Admin
    is_authorized = str(current_user_id) == str(user_id)
    if not is_authorized:
        # Admin check
        whitelist = ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com"]
        if current_user_email and (current_user_email in whitelist or current_user_email.endswith("@hotel.plus")):
            is_authorized = True
        else:
            profile = db.table("user_profiles").select("role").eq("user_id", current_user_id).limit(1).execute()
            if profile.data and profile.data[0].get("role") in ["admin", "market_admin", "market admin"]:
                is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Unauthorized access to this dashboard")

    try:
        # 1. Fetch hotels
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        all_hotels = hotels_result.data or []
        hotels = [h for h in all_hotels if h.get("property_token") or h.get("serp_api_id")]
        
        if not hotels:
            return fallback_data

        # 1.1 BATCH FETCH Price Logs
        hotel_ids = [str(h["id"]) for h in hotels]
        hotel_prices_map = {}
        try:
            # Fetch last 10 logs per hotel group in a single query
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
            print(f"Dashboard: Batch price fetch failed: {e}")

        target_hotel = None
        competitors = []
        
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
                    print(f"Dashboard: Error building price_info for {hotel.get('name')}: {e}")

            valid_history = []
            for p in prices:
                if p.get("price") is not None:
                    valid_history.append({
                        "price": float(p["price"]), 
                        "recorded_at": p.get("recorded_at")
                    })

            hotel_data = {
                **hotel,
                "price_info": price_info,
                "price_history": valid_history
            }
            
            if hotel.get("is_target_hotel"):
                target_hotel = hotel_data
            else:
                competitors.append(hotel_data)
        
        # Fallback: If no target hotel is explicitly selected, use the first one.
        # This prevents the "No Data" screen for users who have hotels but lost the selection state.
        if not target_hotel and competitors:
            # Promote the first competitor to target for display purposes
            target_hotel = competitors.pop(0)

        # 2. Alerts, Searches, Scan History
        unread_count = db.table("alerts").select("id", count="exact").eq("user_id", str(user_id)).eq("is_read", False).execute().count or 0
        
        recent_res = db.table("query_logs").select("*").eq("user_id", str(user_id)).in_("action_type", ["search", "create"]).order("created_at", desc=True).limit(20).execute()
        recent_searches = []
        seen = set()
        for log in (recent_res.data or []):
            name = log.get("hotel_name")
            if name and name not in seen:
                recent_searches.append(log)
                seen.add(name)
            if len(recent_searches) >= 10: break

        scan_res = db.table("query_logs").select("*").eq("user_id", str(user_id)).eq("action_type", "monitor").order("created_at", desc=True).limit(10).execute()
        scan_history = scan_res.data or []

        sess_res = db.table("scan_sessions").select("*").eq("user_id", str(user_id)).order("created_at", desc=True).limit(5).execute()
        recent_sessions = sess_res.data or []

        # 3. Next Scan calculation
        next_scan_at = None
        settings_res = db.table("settings").select("check_frequency_minutes").eq("user_id", str(user_id)).execute()
        if settings_res.data:
            freq = settings_res.data[0].get("check_frequency_minutes", 0)
            if freq > 0 and hotel_ids:
                last_log_res = db.table("price_logs") \
                    .select("recorded_at") \
                    .in_("hotel_id", hotel_ids) \
                    .order("recorded_at", desc=True) \
                    .limit(1) \
                    .execute()
                
                if last_log_res.data:
                    last_run_iso = last_log_res.data[0]["recorded_at"]
                    # Reminder Note: ISO format normalization for multiple timezones
                    last_run = datetime.fromisoformat(last_run_iso.replace("Z", "+00:00"))
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
            "scheduled_status": "Calculating next scan based on last manual or scheduled update."
        }

    except Exception as e:
        print(f"CRITICAL DASHBOARD ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Dashboard Processing Failure: {str(e)}")
