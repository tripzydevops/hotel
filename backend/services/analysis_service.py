"""
Analysis Service
Handles complex market analysis, room type matching, and sentiment data processing.
"""
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

import math
import re
from datetime import datetime, timedelta, timezone
import calendar
from typing import Optional, List, Dict, Any, Tuple
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from supabase import Client
from backend.services.serpapi_client import serpapi_client
from backend.utils.helpers import convert_currency
from backend.utils.sentiment_utils import normalize_sentiment, generate_mentions

def _transform_serp_links(breakdown: Any) -> Any:
    """
    Transforms raw SerpApi JSON links into user-friendly Google Travel URLs.
    
    Why: The raw JSON often contains internal tokens. We convert these to 
    standard review URLs to improve the UI utility for our users.
    """
    if not isinstance(breakdown, list):
        return breakdown
        
    for item in breakdown:
        if isinstance(item, dict) and "link" in item:
            link = item["link"]
            if "google.com/search" in link and "ludocid" in link:
                try:
                    params = dict(re.findall(r'(\w+)=([^&]+)', link))
                    token = params.get("kp") or params.get("ludocid")
                    if token:
                        item["link"] = f"https://www.google.com/travel/hotels/entity/{token}/reviews"
                except Exception:
                    pass
    return breakdown

def _extract_price(raw: Any) -> Optional[float]:
    """Helper to cleanly extract a numeric price from various raw formats (str, int, float)."""
    if raw is not None:
        try:
            if isinstance(raw, str):
                clean = re.sub(r'[^\d.]', '', raw)
                return float(clean)
            return float(raw)
        except Exception: 
            pass
    return None
    
# EXPLANATION: Sentiment Normalization & Synthesis
# We use shared utilities from backend.utils.sentiment_utils to ensure 
# consistency between the Dashboard and Analysis pages.
# This prevents "N/A" issues caused by data-source mismatches.

def get_price_for_room(
    price_log: Dict[str, Any], 
    target_room_type: str, 
    allowed_room_names_map: Dict[str, List[str]]
) -> Tuple[Optional[float], Optional[str], float]:
    """
    Finds the best matching room price within a price log.
    
    Why: Hotel listings have many room types (Standard, Deluxe, etc.). 
    We use high-confidence semantic matching to compare apples-to-apples.
    """
    r_types = price_log.get("room_types") or []
    if not isinstance(r_types, list):
        return None, None, 0.0
        
    # 1. Check for Semantic Match first (if map exists)
    hid = str(price_log.get("hotel_id", ""))
    allowed_names = allowed_room_names_map.get(hid)
    
    if allowed_names:
        for r in r_types:
            if isinstance(r, dict) and r.get("name") in allowed_names:
                 # High confidence if in allowed map
                 return _extract_price(r.get("price")), r.get("name"), 0.82 + (0.1 * int(r.get("name") == target_room_type))
    
    # 2. Fallback: String Match (Substring) with Turkish/English variant support
    # We check for common "standard" room variants in both languages.
    target_variants = [target_room_type.lower()]
    if target_room_type.lower() in ["standard", "standart"]:
         target_variants.extend(["standard", "standart", "klasik", "classic", "ekonomik", "economy", "promo"])
    
    for r in r_types:
        if not isinstance(r, dict): continue
        r_name = (r.get("name") or "").lower()
        c_name = (r.get("canonical_name") or "").lower()
        c_code = (r.get("canonical_code") or "").upper()
        
        # Priority 1: Canonical Code Match (Highest confidence)
        if target_room_type.lower() in ["standard", "standart"] and c_code == "STD":
             return _extract_price(r.get("price")), r.get("name") or "Standard", 0.95

        # Priority 2: Canonical Name Match
        if any(v in c_name for v in target_variants):
             return _extract_price(r.get("price")), r.get("name") or "Standard", 0.9

        # Priority 3: Name Substring Match
        if any(v in r_name for v in target_variants):
            return _extract_price(r.get("price")), r.get("name") or "Standard", 0.85
            
    # EXPLANATION: Standard Request Detection & Global Fallback
    # Why: If no semantic or string match was found, but we are looking for a 'Standard' 
    # room, we fall back to the lowest available room price. 
    # This is a Kaizen 'Error Proofing' measure: display a valid price rather than 'N/A'
    # when the room type catalog or semantic embedding is sparse.
    std_variants = ["standard", "standart", "any", "base", "all room types", "all", "promo", "ekonomik", "economy", "klasik", "classic"]
    target_lower = target_room_type.lower()
    
    is_standard_request = (
        not target_lower or 
        any(v in target_lower for v in std_variants) or
        target_lower == "oda" # Generic 'Room' in Turkish
    )
    
    if is_standard_request:
        try:
            valid_prices = []
            for r in r_types:
                p = _extract_price(r.get("price"))
                if p is not None:
                    valid_prices.append((p, r.get("name") or "Standard (Min)"))
            
            if valid_prices:
                valid_prices.sort(key=lambda x: x[0])
                # Increase confidence (0.65) for lowest-price fallback to guarantee UI display
                return valid_prices[0][0], valid_prices[0][1], 0.65
        except Exception:
            pass

    # If price found is 0, we treat as None for calculations but mark as sellout
    match_price = None
    match_name = None
    confidence = 0.0

    if (not r_types or len(r_types) == 0) and is_standard_request:
        top_price = _extract_price(price_log.get("price"))
        if top_price is not None:
            # Kaizen: Improved confidence for legacy data to ensure continuity
            match_price, match_name, confidence = top_price, "Standard (Legacy)", 0.7
            
    # If match_price is 0, we return it as 0.0 to indicate sellout
    return match_price, match_name, confidence

async def perform_market_analysis(
    user_id: str,
    hotels: List[Dict[str, Any]],
    hotel_prices_map: Dict[str, List[Dict[str, Any]]],
    display_currency: str,
    room_type: str,
    start_date: Optional[str],
    end_date: Optional[str],
    allowed_room_names_map: Dict[str, List[str]]
) -> Dict[str, Any]:
    """
    Executes the core market analysis logic.
    
    Why: This is the heavy lifting of the Dashboard. It calculates Price Rank, 
    Market Average, Sentiment Index, and the Quadrant Status. 
    Extracted from main.py to improve AI responsiveness and modularity.
    """
    current_prices: List[float] = []
    market_sentiments: List[float] = []
    target_history: List[Dict[str, Any]] = []
    target_price: Optional[float] = None
    target_hotel_id: Optional[str] = None
    target_hotel_name: str = "Unknown Hotel"
    target_sentiment: float = 0.0
    price_rank_list: List[Dict[str, Any]] = []

    # 1. Map Prices and Find Target
    for hotel in hotels:
        hid = str(hotel["id"])
        hotel_rating = float(hotel.get("rating") or 0.0)
        reviews = int(hotel.get("review_count") or 0)
        
        weight = math.log10(reviews + 10) / 2.0 
        weighted_sentiment = hotel_rating * weight
        market_sentiments.append(weighted_sentiment)
        
        if hotel.get("is_target_hotel"):
            target_hotel_id = hid
            target_hotel_name = hotel.get("name") or "Unknown"
            target_sentiment = weighted_sentiment

    # EXPLANATION: Target Hotel Auto-Select Fallback
    # If no hotel has is_target_hotel=True (common for new users who haven't 
    # configured their target yet), we auto-select the first hotel in their list.
    # Without this, ALL analysis KPIs show "N/A" and the Discovery page says
    # "No hotel configured. Add a target hotel first."
    if not target_hotel_id and hotels:
        target_hotel_id = str(hotels[0]["id"])
        target_hotel_name = hotels[0].get("name") or "Unknown"
        target_sentiment = float(hotels[0].get("rating") or 0.0)
            
    # 2. Build price rank list
    available_room_types = set()

    for hotel in hotels:
        hid = str(hotel["id"])
        is_target = (hid == target_hotel_id)
        prices = hotel_prices_map.get(hid, [])
        
        # Track all room types for filter UI
        for p in prices:
            rt = p.get("room_types")
            if isinstance(rt, list):
                for r in rt:
                    if isinstance(r, dict) and r.get("name"):
                        available_room_types.add(r["name"])

        if prices:
            try:
                lead_currency = prices[0].get("currency") or "USD"
                orig_price, matched_room, match_score = get_price_for_room(prices[0], room_type, allowed_room_names_map)
                
                if orig_price is not None:
                    # Detect Sellout (0.0 or less)
                    is_sellout = (orig_price <= 0)
                    converted = convert_currency(orig_price, lead_currency, display_currency)
                    
                    if not is_sellout:
                        current_prices.append(converted)
                    
                    price_rank_list.append({
                        "id": hid,
                        "name": hotel.get("name"),
                        "price": converted,
                        "rating": hotel.get("rating"),
                        "is_target": is_target,
                        "is_sellout": is_sellout, # CRITICAL: Inform frontend of sellout
                        "offers": prices[0].get("parity_offers") or prices[0].get("offers") or [],
                        "room_types": prices[0].get("room_types") or [],
                        "matched_room_name": matched_room,
                        "match_score": match_score
                    })
                    
                    if is_target:
                        target_price = converted
                        # Explicitly slice prices to avoid linter issues
                        p_subset = prices[:30]
                        for p in p_subset: 
                            hist_price, _, _ = get_price_for_room(p, room_type, allowed_room_names_map)
                            if hist_price is not None:
                                target_history.append({
                                    "price": convert_currency(float(hist_price), p.get("currency") or "USD", display_currency),
                                    "recorded_at": p.get("recorded_at")
                                })
            except Exception as e:
                logger.error(f"Analysis error for hotel {hid}: {e}")

    price_rank_list.sort(key=lambda x: x["price"])
    for i, item in enumerate(price_rank_list):
        item["rank"] = i + 1

    # 3. Build Daily Prices for Calendar (Smart Continuity)
    daily_prices: List[Dict[str, Any]] = []
    if target_hotel_id:
        # EXPLANATION: Smart Continuity (Read-Time Vertical Fill)
        # We group logs by hotel and check-in date. For each date:
        # 1. We take the latest scan result.
        # 2. If it failed (price=0 or None), we look back at previous scans for that SAME check-in date.
        # 3. If a successful scan is found within history, we use it and mark as 'Estimated'.
        date_price_map: Dict[str, Dict[str, Any]] = {}

        for hid, prices in hotel_prices_map.items():
            # prices are sorted by recorded_at DESC
            # Group by check-in date
            checkin_groups = {}
            for p in prices:
                d = str(p.get("check_in_date", "")).split('T')[0]
                if not d: continue
                if d not in checkin_groups: checkin_groups[d] = []
                checkin_groups[d].append(p)

            for d_str, logs in checkin_groups.items():
                if d_str not in date_price_map:
                    date_price_map[d_str] = {"target": None, "target_is_estimated": False, "competitors": []}
                
                # EXPLANATION: Rate Calendar Continuity (Vertical Fill)
                # We prioritize fresh data for the specific check-in date.
                # If the latest scan failed (e.g., Sold Out), we look back 7 days for 
                # a previous successful scan for the SAME check-in date.
                # If that ALSO fails, we fall back to ANY recent valid price for this hotel.
                # This ensures the Grid stays populated while clearly marking the data as 'Estimated'.
                
                # Analyze the logs for this specific check-in date
                latest = logs[0]
                price_val, _, _ = get_price_for_room(latest, room_type, allowed_room_names_map)
                is_est = latest.get("is_estimated", False)
                
                # 1. Look back for SAME check-in date (Same-Date Continuity)
                if (price_val is None or price_val <= 0) and len(logs) > 1:
                    try:
                        latest_str = latest.get("recorded_at", "").replace('Z', '+00:00')
                        latest_time = datetime.fromisoformat(latest_str)
                        
                        for prev in logs[1:]:
                            prev_str = prev.get("recorded_at", "").replace('Z', '+00:00')
                            prev_time = datetime.fromisoformat(prev_str)
                            
                            if (latest_time - prev_time).days <= 7:
                                prev_p, _, _ = get_price_for_room(prev, room_type, allowed_room_names_map)
                                if prev_p and prev_p > 0:
                                    price_val = prev_p
                                    is_est = True 
                                    break
                    except Exception: pass

                # 2. Global Fallback for this Hotel (Any-Date Continuity)
                if price_val is None or price_val <= 0:
                    # Look through ALL prices for this hotel (outside this check-in group)
                    # hotel_prices_map[hid] contains all logs sorted by recorded_at DESC
                    all_hotel_logs = hotel_prices_map.get(hid, [])
                    for fallback_log in all_hotel_logs:
                        fb_p, _, _ = get_price_for_room(fallback_log, room_type, allowed_room_names_map)
                        if fb_p and fb_p > 0:
                            price_val = fb_p
                            is_est = True
                            break

                if price_val is not None:
                    converted_price = convert_currency(price_val, latest.get("currency") or "USD", display_currency)
                    hotel_name = next((h["name"] for h in hotels if str(h["id"]) == hid), "Unknown")
                    
                    if hid == target_hotel_id:
                        date_price_map[d_str]["target"] = converted_price
                        date_price_map[d_str]["target_is_estimated"] = is_est
                    else:
                        date_price_map[d_str]["competitors"].append({
                            "name": hotel_name, 
                            "price": converted_price,
                            "is_estimated": is_est
                        })
        
        range_start = datetime.now()
        if start_date:
            try: 
                ds = str(start_date).split('T')[0]
                range_start = datetime.strptime(ds, "%Y-%m-%d")
            except Exception: pass
        
        range_end = range_start + timedelta(days=30)
        if end_date:
            try: 
                de = str(end_date).split('T')[0]
                range_end = datetime.strptime(de, "%Y-%m-%d")
            except Exception: pass
        
        curr = range_start
        # EXPLANATION: State tracking for Grid Continuity (Horizontal Fill)
        # We track the last known price for each hotel to fill gaps in the 
        # grid when a specific check-in date doesn't have a record.
        # This prevents the 'dash' or 'N/A' flicker when data is sparse.
        last_known_target = None
        competitor_states: Dict[str, Dict[str, Any]] = {} # name -> {price, recorded_at}
        
        today_date = datetime.now().date()
        while curr.date() <= range_end.date():
            current_date = curr.date()
            d_str = curr.strftime("%Y-%m-%d")
            data = date_price_map.get(d_str)
            
            comp_avg = 0.0
            vs_comp = 0.0
            unique_competitors = []
            target_val = None
            
            # 1. Target Logic (Primary + Conditional Forward Fill)
            # EXPLANATION: Restricted Forward Fill (Kaizen)
            # Why: The user wants to avoid misleading 'estimated' prices for future dates.
            # We only forward-fill missing grid days if the date is in the past OR
            # if we have actual scan data for that specific future date.
            if data and data["target"] is not None:
                last_known_target = float(data["target"])
                target_val = last_known_target
            elif last_known_target is not None and current_date <= today_date:
                # Only carry forward for past/today to fill gaps in historical data
                target_val = last_known_target
            
            # 2. Competitor Logic (Conditional Full Fill)
            daily_comps = (data.get("competitors") if data else []) or []
            
            # Update state for current check-in date matches
            for c in daily_comps:
                competitor_states[c["name"]] = {
                    "price": c["price"],
                    "is_estimated": c.get("is_estimated", False)
                }
            
            seen_competitors = set()
            for c in daily_comps:
                if c["name"] not in seen_competitors:
                    unique_competitors.append(c)
                    seen_competitors.add(c["name"])
            
            # Horizontal Continuity (Competitor Fill) - Restricted to past/today
            for name, state in competitor_states.items():
                if name not in seen_competitors:
                    # Only carry competitor prices forward if in the past
                    if current_date <= today_date:
                        unique_competitors.append({
                            "name": name,
                            "price": state["price"],
                            "is_estimated": True 
                        })
                        seen_competitors.add(name)
            
            if unique_competitors:
                comp_avg = sum(float(c["price"]) for c in unique_competitors) / len(unique_competitors)
                if target_val:
                    vs_comp = ((target_val - comp_avg) / comp_avg) * 100 if comp_avg > 0 else 0.0

            # KAİZEN: Sellout Detection for Calendar
            # If the final target_val is 0, we mark the DAY as sellout.
            # (Note: target_val might be None if restricted due to future date)
            is_day_sellout = (target_val is not None and target_val <= 0)

            daily_prices.append({
                "date": d_str,
                "price": round(float(target_val), 2) if target_val is not None else None,
                "is_estimated_target": data.get("target_is_estimated", False) if data else False,
                "is_sellout": is_day_sellout, # Tag for frontend "Possible Sellout"
                "comp_avg": round(float(comp_avg), 2),
                "vs_comp": round(float(vs_comp), 1),
                "competitors": unique_competitors
            })
            curr += timedelta(days=1)

    # EXPLANATION: ARI & Sentiment Index Calculation
    # ARI (Average Rate Index) = (your price / market avg) × 100.
    # Sentiment Index = (your weighted rating / market avg rating) × 100.
    # Both default to None (not 100.0) when data is insufficient, so the
    # frontend displays "N/A" instead of a misleading "100% LOW".
    market_avg = sum(current_prices) / len(current_prices) if current_prices else 0.0
    ari = (target_price / market_avg) * 100 if target_price and market_avg > 0 else None
    avg_sent = sum(market_sentiments) / len(market_sentiments) if market_sentiments else 0.0
    sent_index = (target_sentiment / avg_sent) * 100 if target_sentiment and avg_sent > 0 else None
    
    q_x = max(-50.0, min(50.0, float(ari) - 100.0)) if ari is not None else 0.0
    q_y = max(-50.0, min(50.0, float(sent_index) - 100.0)) if sent_index is not None else 0.0
    
    advisory = ""
    q_label = "Neutral"
    # EXPLANATION: Quadrant Advisory — None-Safe
    # When ARI or Sentiment is None (no competitor data), we show a helpful
    # message instead of placing the hotel in a misleading quadrant position.
    if ari is None or sent_index is None:
        q_label = "Insufficient Data"
        advisory = "Not enough competitor data to calculate market position. Add more hotels to your tracking list."
    elif ari >= 100 and sent_index >= 100:
        q_label = "Premium King"
        advisory = f"Strategic Peak: You are commanding a premium price (${int(target_price or 0)}) with superior sentiment."
    elif ari < 100 and sent_index >= 100:
        q_label = "Value Leader"
        advisory = f"Expansion Opportunity: Your price is {int(100 - ari)}% below market avg despite high guest satisfaction."
    elif ari >= 100 and sent_index < 100:
        q_label = "Danger Zone"
        advisory = f"Caution: Your rate is {int(ari - 100)}% above market, unsupported by current sentiment."
    else:
        q_label = "Budget / Economy"
        advisory = f"Volume Strategy: Your rate is {int(100 - ari)}% below market average."

    # 5. Competitors List
    comp_list = []
    for h in hotels:
        if str(h["id"]) != target_hotel_id:
            p = hotel_prices_map.get(str(h["id"]), [])
            if p:
                try:
                    price_val = float(p[0]["price"])
                    comp_list.append({
                        "id": str(h["id"]),
                        "name": h.get("name"),
                        "price": convert_currency(price_val, p[0].get("currency") or "USD", display_currency),
                        "rating": h.get("rating"),
                        "offers": p[0].get("parity_offers") or p[0].get("offers") or []
                    })
                except: continue

    target_h = next((h for h in hotels if str(h["id"]) == target_hotel_id), None)
    
    # EXPLANATION: Calculate Market Min/Max/Avg
    # We calculate these statistics on the fly from the current price list 
    # to ensure the dashboard reflects the real-time slice of data.
    market_min = min(current_prices) if current_prices else None
    market_max = max(current_prices) if current_prices else None
    
    # Find Min/Max Hotels
    min_hotel = next((p for p in price_rank_list if p["price"] == market_min), None) if market_min is not None else None
    max_hotel = next((p for p in price_rank_list if p["price"] == market_max), None) if market_max is not None else None

    # Calculate Market Rank
    market_rank = next((p["rank"] for p in price_rank_list if p["id"] == target_hotel_id), None)

    return {
        "hotel_id": target_hotel_id,
        "hotel_name": target_hotel_name,
        "market_avg": round(float(market_avg), 2),
        "market_average": round(float(market_avg), 2), # Frontend Alias
        "market_min": round(float(market_min), 2) if market_min is not None else None,
        "market_max": round(float(market_max), 2) if market_max is not None else None,
        "min_hotel": min_hotel,
        "max_hotel": max_hotel,
        "market_rank": market_rank,
        "competitive_rank": market_rank, # Frontend Alias
        "total_hotels": len(price_rank_list),
        "target_price": round(float(target_price), 2) if target_price is not None else None,
        "ari": round(float(ari), 1) if ari is not None else None,
        "sentiment_index": round(float(sent_index), 1) if sent_index is not None else None,
        "advisory_msg": advisory,
        "quadrant_x": round(float(q_x), 1),
        "quadrant_y": round(float(q_y), 1),
        "quadrant_label": q_label,
        "price_rank_list": price_rank_list,
        "daily_prices": daily_prices,
        "competitors": comp_list,
        "price_history": target_history,
        "sentiment_breakdown": normalize_sentiment(_transform_serp_links(target_h.get("sentiment_breakdown"))) if target_h else None,
        "guest_mentions": target_h.get("guest_mentions") or generate_mentions(target_h.get("sentiment_breakdown")) if target_h else [],
        "available_room_types": sorted(list(available_room_types)),
        "all_hotels": [{"id": str(h["id"]), "name": h.get("name"), "is_target": str(h["id"]) == target_hotel_id} for h in hotels]
    }

async def get_market_intelligence_data(
    db: Client,
    user_id: str,
    room_type: str = "Standard",
    display_currency: str = "TRY",
    currency: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Orchestrates the data gathering for market intelligence.
    
    EXPLANATION: Single-Source Data Path (Cleaned Up)
    Previously this function fetched from both 'price_logs' (active) AND 'query_logs'
    (legacy) tables, then merged them. This doubled query cost and added complexity.
    Now uses ONLY 'price_logs' with a 90-day time window instead of a hardcoded
    limit(5000), providing predictable scaling as data grows.
    """
    # Currency Alias
    if currency:
        display_currency = currency
        
    hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
    hotels = hotels_result.data or []
    if not hotels:
        return {"summary": {}, "hotels": []}

    # EXPLANATION: Time-Windowed Price Fetching (replaces limit(5000))
    # A 90-day rolling window is more predictable than a fixed row count.
    # As data grows, limit(5000) would either miss data or cause memory spikes.
    # The time window scales linearly with calendar time, not data volume.
    from datetime import datetime, timedelta
    cutoff_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
    
    price_logs_res = db.table("price_logs") \
        .select("*") \
        .in_("hotel_id", [str(h["id"]) for h in hotels]) \
        .gte("recorded_at", cutoff_date) \
        .order("recorded_at", desc=True) \
        .execute()
    logs_data = price_logs_res.data or []
    
    # Group logs by hotel_id
    hotel_prices_map = {}
    for log in logs_data:
        hid = str(log["hotel_id"])
        if hid not in hotel_prices_map:
            hotel_prices_map[hid] = []
        hotel_prices_map[hid].append(log)
        
    # Ensure every hotel has at least an empty list if no logs found
    for h in hotels:
        hid = str(h["id"])
        if hid not in hotel_prices_map:
            hotel_prices_map[hid] = []
    
    # Room Type Slicing Logic (pgvector)
    allowed_room_names_map = {}
    try:
        catalog_res = db.table("room_type_catalog").select("embedding") \
            .ilike("normalized_name", f"%{room_type}%").limit(1).execute()
        
        # Fallback for Standard/Standart mismatch in catalog
        if not catalog_res.data and room_type.lower() == "standard":
            catalog_res = db.table("room_type_catalog").select("embedding") \
                .ilike("normalized_name", "%standart%").limit(1).execute()
        elif not catalog_res.data and room_type.lower() == "standart":
            catalog_res = db.table("room_type_catalog").select("embedding") \
                .ilike("normalized_name", "%standard%").limit(1).execute()

        if catalog_res.data:
            embedding = catalog_res.data[0]["embedding"]
            matches_res = db.rpc("match_room_types", {
                "query_embedding": embedding,
                "match_threshold": 0.82,
                "match_count": 100 
            }).execute()
            for match in (matches_res.data or []):
                hid = str(match["hotel_id"])
                if hid not in allowed_room_names_map:
                    allowed_room_names_map[hid] = set()
                allowed_room_names_map[hid].add(match["original_name"])
            for h in hotels:
                hid = str(h["id"])
                if hid not in allowed_room_names_map:
                    allowed_room_names_map[hid] = set()
                allowed_room_names_map[hid].add(room_type)
    except Exception:
        pass

    return await perform_market_analysis(
        user_id=str(user_id),
        hotels=hotels,
        hotel_prices_map=hotel_prices_map,
        display_currency=display_currency,
        room_type=room_type,
        start_date=start_date,
        end_date=end_date,
        allowed_room_names_map=allowed_room_names_map
    )
