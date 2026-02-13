"""
Analysis Service
Handles complex market analysis, room type matching, and sentiment data processing.
"""

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
    
# EXPLANATION: Sentiment Normalization
# Google Reviews returns sentiment in natural-language categories that vary by locale
# (e.g., Turkish: "Oda", "Temizlik"; English: "Room", "Cleanliness"). The frontend 
# expects exactly 4 standard pillars: Cleanliness, Service, Location, Value.
# Without this mapping, categories appear as "N/A" on the Sentiment Analysis page.
def _normalize_sentiment(breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Standardizes sentiment categories to the 4 core pillars: 
    Cleanliness, Service, Location, Value. 
    
    Why: Google Reviews uses natural language categorization (e.g., "Oda", "Atmosphere"),
    which leads to "N/A" on the UI if not mapped to our standard metrics.
    """
    if not breakdown:
        return []

    # 1. Define Mappings (Target -> Source Keywords)
    mappings = {
        "Cleanliness": ["temizlik", "cleanliness", "oda", "room", "banyo", "bathroom", "hijyen", "hygiene", "housekeeping"],
        "Service": ["hizmet", "service", "personel", "staff", "ilgi", "reception", "resepsiyon", "kahvaltı", "breakfast"],
        "Location": ["konum", "location", "yer", "place", "manzara", "view", "ulaşım", "access", "çevre"],
        "Value": ["fiyat", "price", "değer", "value", "fiyat-performans", "cost", "ucuzluk", "maliyet"]
    }

    # 2. Key-based lookup for existing categories
    # existing_keys = {item.get("name", "").lower() for item in breakdown} 
    # (Commented out: we allow overwriting/aliasing to ensure coverage)

    normalized = list(breakdown) # Copy original
    
    # 3. Find missing pillars and try to fill them from available data
    for pillar, keywords in mappings.items():
        # Check if we already have this pillar (exact match)
        has_pillar = any(b.get("name", "").lower() == pillar.lower() for b in breakdown)
        if has_pillar:
            continue
            
        # If not, look for a proxy in the raw data
        for item in breakdown:
            name = item.get("name", "").lower()
            if name in keywords:
                # Found a proxy! Create a standardized entry.
                # We clone it so we don't destroy the original named category (which shows in "Voices")
                proxy = item.copy()
                proxy["name"] = pillar # Rename to standard
                proxy["is_inferred"] = True
                normalized.append(proxy)
                break # Found one for this pillar, move to next
                
    return normalized

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
    
    # 2. Fallback: String Match (Substring)
    for r in r_types:
        if isinstance(r, dict) and (target_room_type.lower() in (r.get("name") or "").lower()):
            return _extract_price(r.get("price")), r.get("name"), 0.9 if r.get("name") == target_room_type else 0.75
            
    # EXPLANATION: Cheapest Room Fallback
    # Many Turkish hotels don't have a room labeled "Standard" — they use
    # names like "Oda" or "Standart Oda". When the semantic and substring 
    # matches both fail, we fall back to the cheapest available room price.
    # This ensures charts always show data instead of "No Data".
    if target_room_type.lower() in ["standard", "any", "base"]:
        try:
            # Filter out obviously wrong types if possible, or just grab min price
            valid_prices = []
            for r in r_types:
                p = _extract_price(r.get("price"))
                if p is not None:
                    valid_prices.append((p, r.get("name")))
            
            if valid_prices:
                # Sort by price ascending
                valid_prices.sort(key=lambda x: x[0])
                return valid_prices[0][0], valid_prices[0][1], 0.5  # Lower match score to indicate fallback
        except Exception:
            pass

    return None, None, 0.0

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
                    converted = convert_currency(orig_price, lead_currency, display_currency)
                    current_prices.append(converted)
                    
                    price_rank_list.append({
                        "id": hid,
                        "name": hotel.get("name"),
                        "price": converted,
                        "rating": hotel.get("rating"),
                        "is_target": is_target,
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
                print(f"Analysis error for hotel {hid}: {e}")

    price_rank_list.sort(key=lambda x: x["price"])
    for i, item in enumerate(price_rank_list):
        item["rank"] = i + 1

    # 3. Build Daily Prices for Calendar
    daily_prices: List[Dict[str, Any]] = []
    if target_hotel_id:
        date_price_map: Dict[str, Dict[str, Any]] = {}
        for hid, prices in hotel_prices_map.items():
            for p in prices:
                try:
                    raw_date = str(p.get("check_in_date", ""))
                    date_str = raw_date.split('T')[0]
                    if date_str not in date_price_map:
                        date_price_map[date_str] = {"target": None, "competitors": []}
                    
                    price_val = float(p["price"]) if p.get("price") is not None else None
                    if price_val is not None:
                        converted_price = convert_currency(price_val, p.get("currency") or "USD", display_currency)
                        hotel_name = next((h["name"] for h in hotels if str(h["id"]) == hid), "Unknown")
                        if hid == target_hotel_id:
                            date_price_map[date_str]["target"] = converted_price
                        else:
                            date_price_map[date_str]["competitors"].append({"name": hotel_name, "price": converted_price})
                except Exception: continue
        
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
        last_known_target = None
        while curr.date() <= range_end.date():
            d_str = curr.strftime("%Y-%m-%d")
            data = date_price_map.get(d_str)
            
            comp_avg = 0.0
            vs_comp = 0.0
            unique_competitors = []
            target_val = None
            
            if data and data["target"] is not None:
                last_known_target = float(data["target"])
                target_val = last_known_target
            elif last_known_target is not None and curr.date() <= datetime.now().date():
                target_val = last_known_target
            
            if data:
                seen = set()
                for c in data.get("competitors") or []:
                    if c["name"] not in seen:
                        seen.add(c["name"])
                        unique_competitors.append(c)
                if unique_competitors:
                    comp_avg = sum(float(c["price"]) for c in unique_competitors) / len(unique_competitors)
                    if target_val:
                        vs_comp = ((target_val - comp_avg) / comp_avg) * 100 if comp_avg > 0 else 0.0

            daily_prices.append({
                "date": d_str,
                "price": round(float(target_val), 2) if target_val is not None else None,
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
    
    return {
        "hotel_id": target_hotel_id,
        "hotel_name": target_hotel_name,
        "market_avg": round(float(market_avg), 2),
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
        "sentiment_breakdown": _normalize_sentiment(_transform_serp_links(target_h.get("sentiment_breakdown"))) if target_h else None,
        "available_room_types": sorted(list(available_room_types))
    }
