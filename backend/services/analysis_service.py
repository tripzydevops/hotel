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
from backend.utils.sentiment_utils import normalize_sentiment, generate_mentions, translate_breakdown, synthesize_value_score

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
    if raw is None: return None
    try:
        if isinstance(raw, (float, int)):
            return float(raw)
            
        s = str(raw).strip()
        # Remove currency symbols and whitespace
        s_clean = re.sub(r'[^\d.,]', '', s)
        
        # Case 1: Both . and , exist (e.g. "3.825,00" or "3,825.00")
        if '.' in s_clean and ',' in s_clean:
            if s_clean.rfind(',') > s_clean.rfind('.'):
                # Turkish/European: Dot is thousand, Comma is decimal
                s_clean = s_clean.replace('.', '').replace(',', '.')
            else:
                # US/UK: Comma is thousand, Dot is decimal
                s_clean = s_clean.replace(',', '')
                
        # Case 2: Only Dot exists (e.g. "3.825" or "150.50")
        elif '.' in s_clean:
            # If it looks like a thousand separator (3 decimal places exactly)
            # AND the value if treated as float is suspiciously small (< 500)
            # We treat dot as thousand separator.
            parts = s_clean.split('.')
            if len(parts) == 2 and len(parts[1]) == 3:
                val = float(s_clean)
                if val < 500: # Threshold: 500 is extremely low for a hotel price
                     s_clean = s_clean.replace('.', '')
        
        # Case 3: Only Comma exists (e.g. "125,50")
        elif ',' in s_clean:
            # Assume comma is decimal (common in TR)
            s_clean = s_clean.replace(',', '.')
            
        return float(s_clean)
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
                 # KAIZEN: "Strict Keyword Guard"
                 # Even if DB/Vector Search maps "Standard Room" to "Suite", we REJECT it 
                 # if the names mismatch significantly.
                 r_name = r.get("name", "")
                 t_lower = target_room_type.lower()
                 r_lower = r_name.lower()
                 
                 # 1. Suite Guard: If asking for Suite, offer MUST have "suite" or "süit" in name
                 if "suite" in t_lower and not any(k in r_lower for k in ["suite", "süit"]):
                     continue
                     
                 # 2. Villa/Res Guard
                 if "villa" in t_lower and "villa" not in r_lower:
                     continue

                 # High confidence if in allowed map (and passed guards)
                 return _extract_price(r.get("price")), r_name, 0.82 + (0.1 * int(r_name == target_room_type))
    
    # 2. Fallback: String Match (Substring) with Turkish/English variant support
    # We check for common "standard" room variants in both languages.
    target_variants = [target_room_type.lower()]
    # Improved check: detect 'standard' even if it's 'Standard Room'
    if any(s in target_room_type.lower() for s in ["standard", "standart"]):
         target_variants.extend(["standard", "standart", "klasik", "classic", "ekonomik", "economy", "promo"])
    # Kaizen: Add Suite synonyms (Turkish)
    if "suite" in target_room_type.lower():
         target_variants.append("süit")
    
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
    # KAIZEN (2026-02-19): We disable this fallback for specific room types (e.g., Suite)
    # to prevent misleading comparisons. If you ask for Suite, you get Suite or N/A.
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
                if not isinstance(r, dict): continue
                p = _extract_price(r.get("price"))
                if p is not None:
                    valid_prices.append((p, r.get("name") or "Standard (Min)"))
            
            if valid_prices:
                valid_prices.sort(key=lambda x: x[0])
                # Increase confidence (0.65) for lowest-price fallback to guarantee UI display
                return valid_prices[0][0], valid_prices[0][1], 0.65
        except Exception:
            pass
    # Else: Strict Mode. We return None if no match found for specific/premium room types.


def generate_synthetic_narrative(
    ari: Optional[float], 
    sent_index: Optional[float], 
    dna_text: Optional[str],
    hotel_name: str
) -> str:
    """
    KAIZEN: Synthetic AI Narrative ("So What?" Card)
    Generates a high-level strategic verdict based on pricing (ARI), 
    guest sentiment (GRI/SentIndex), and the hotel's DNA.
    """
    if ari is None or sent_index is None:
        return "Insufficient market data to generate a strategic narrative. Please ensure competitors and target prices are correctly configured."

    # Status buckets
    price_status = "premium" if ari >= 105 else "aligned" if ari >= 95 else "aggressive"
    sent_status = "superior" if sent_index >= 105 else "standard" if sent_index >= 95 else "at-risk"
    
    dna_blurb = f" Guided by your '{dna_text}' strategy," if dna_text else ""
    
    # Narrative creation
    if price_status == "premium" and sent_status == "superior":
        return f"{hotel_name} is currently a 'Premium King'.{dna_blurb} you are successfully justifying higher rates through superior guest experiences. Maintain this trajectory to maximize ADR."
    elif price_status == "aggressive" and sent_status == "superior":
        return f"Despite your '{price_status}' pricing,{dna_blurb} guests are providing {sent_status} feedback. This indicates room to push rates upward by 3-5% without compromising volume."
    elif price_status == "premium" and sent_status == "at-risk":
        return f"Warning: Your pricing is in the danger zone.{dna_blurb} your rates are {int(ari-100)}% above market average, but sentiment is lagging. Expect a drop in occupancy unless service quality improves immediately."
    elif price_status == "aggressive" and sent_status == "at-risk":
        return f"{hotel_name} is in a budget-volume cycle. With {price_status} rates and {sent_status} sentiment, focus on operational essentials to prevent a 'race to the bottom'."
    
    # Fallback
    return f"{hotel_name} is maintaining a balanced market position.{dna_blurb} stay vigilant on competitor parity to protect your current rank."


def calculate_rate_recommendation(
    ari: Optional[float], 
    sent_index: Optional[float], 
    current_price: Optional[float]
) -> dict:
    """
    KAIZEN: Rate Recommendation Engine
    Returns suggested action, percentage, and reasoning.
    """
    if not ari or not sent_index or not current_price:
        return {"action": "no_data", "impact": 0, "reason": "Insufficient market benchmarks."}

    # Scenario A: Underpriced Value Leader
    if sent_index >= 105 and ari < 95:
        return {
            "action": "increase",
            "amount": 5,
            "new_price": round(current_price * 1.05),
            "reason": "Strong guest sentiment justifies a higher rate. Capture missing ADR."
        }
    
    # Scenario B: Overpriced & At-Risk
    if sent_index < 95 and ari > 105:
        return {
            "action": "decrease",
            "amount": -5,
            "new_price": round(current_price * 0.95),
            "reason": "Sentiment is lagging behind high rates. Reduce to protect occupancy."
        }
    
    # Scenario C: Parity Aggression
    if ari < 85:
        return {
            "action": "maintain",
            "amount": 0,
            "reason": "Deep discounting detected. Monitor if this is gaining volume or just losing margin."
        }

    return {
        "action": "maintain",
        "amount": 0,
        "new_price": current_price,
        "reason": "Current pricing is aligned with market sentiment and competitor benchmarks."
    }


def generate_audit_checklist(target_h: dict, market_avg_scores: dict) -> list:
    """
    KAIZEN: Operational Audit Checklist
    Identifies specific pillar weaknesses compared to market average.
    """
    checklist = []
    if not target_h or not market_avg_scores:
        return checklist

    pillars = ["Cleanliness", "Service", "Location", "Value"]
    
    for pillar in pillars:
        my_score = getCategoryScore(target_h, pillar.lower())
        mkt_score = market_avg_scores.get(pillar, 3.5)
        
        if my_score > 0 and my_score < mkt_score * 0.95:
            diff_pct = round(( (mkt_score - my_score) / mkt_score ) * 100)
            checklist.append({
                "pillar": pillar,
                "issue": f"{pillar} score is {diff_pct}% below market average.",
                "action": f"Task: Conduct {pillar} audit and review recent staff feedback."
            })
    
    # Fallback success message
    if not checklist:
        checklist.append({
            "pillar": "Global",
            "issue": "All pillars are performing at or above market average.",
            "action": "Maintain current operational standards."
        })
        
    return checklist[:3] # Max 3 items


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
                
                # DIAGNOSTIC: Log per-hotel matching result
                hotel_label = hotel.get("name", "?")[:25]
                rt_count = len(prices[0].get("room_types") or [])
                top_price = prices[0].get("price")
                logger.info(f"[DIAG] Hotel '{hotel_label}': {len(prices)} logs, top_price={top_price}, room_types={rt_count}, matched={matched_room}, orig_price={orig_price}, score={match_score:.2f}")
                
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

    # 2.5 Build Competitors List (Needed for Calendar Continuity seeding)
    # EXPLANATION: Competitor List Population Logic
    # We populate `comp_list` early and verify its contents to support data consistency
    # in the Market Intelligence Grid. Moving this here resolved the previously reported 
    # 'No Data' issues caused by late initialization.
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
        # We seed the initial state from the latest overall scan (target_price)
        # to ensure the grid starts populated even if early dates lack specific scans.
        last_known_target = target_price
        # EXPLANATION: Competitor Price State Initialization
        # We initialize `competitor_states` here to ensure it exists even if the logic below
        # for processing `comp_list` branches differently. This prevents UnboundLocalError.
        competitor_states: Dict[str, Dict[str, Any]] = {
            c["name"]: {"price": c["price"], "is_estimated": True} for c in comp_list
        }
        
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

    # 6. Sentiment Breakdown & Synthesis
    sent_bd = normalize_sentiment(_transform_serp_links(target_h.get("sentiment_breakdown"))) if target_h else []
    raw_bd = translate_breakdown(_transform_serp_links(target_h.get("sentiment_breakdown"))) if target_h else []
    
    # KAİZEN: Value Synthesis if missing
    # If Value score is 0 but we have competitive data, we can synthesize based on ARI
    value_pillar = next((p for p in sent_bd if p["name"] == "Value"), None)
    if value_pillar and value_pillar.get("total_mentioned", 0) == 0:
        if target_price and market_avg > 0:
            ari_val = (target_price / market_avg) * 100
            syn_val = synthesize_value_score(ari_val)
            value_pillar.update(syn_val)

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
        "sentiment_breakdown": sent_bd,
        "market_avg_scores": market_avg_scores,
        "recommendation": calculate_rate_recommendation(ari, sent_index, target_price),
        "audit_checklist": generate_audit_checklist(target_h, market_avg_scores) if target_h else [],
        "sentiment_raw_breakdown": raw_bd,
        "guest_mentions": target_h.get("guest_mentions") or generate_mentions(target_h.get("sentiment_breakdown")) if target_h else [],
        "available_room_types": sorted(list(available_room_types)),
        "all_hotels": [{"id": str(h["id"]), "name": h.get("name"), "is_target": str(h["id"]) == target_hotel_id} for h in hotels],
        "pricing_dna_text": target_h.get("pricing_dna_text") if target_h else None,
        "synthetic_narrative": generate_synthetic_narrative(
            ari, 
            sent_index, 
            target_h.get("pricing_dna_text") if target_h else None,
            target_hotel_name
        )
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
        
    hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).is_("deleted_at", "null").execute()
    hotels = hotels_result.data or []
    
    # DIAGNOSTIC: Log hotel count for this user
    logger.info(f"[DIAG] User {user_id}: Found {len(hotels)} hotels")
    
    if not hotels:
        logger.warning(f"[DIAG] User {user_id}: No hotels found, returning empty")
        return {"summary": {}, "hotels": []}

    # EXPLANATION: Time-Windowed Price Fetching (replaces limit(5000))
    # A 90-day rolling window is more predictable than a fixed row count.
    # As data grows, limit(5000) would either miss data or cause memory spikes.
    # The time window scales linearly with calendar time, not data volume.
    from datetime import datetime, timedelta
    cutoff_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
    
    hotel_ids_list = [str(h["id"]) for h in hotels]
    logger.info(f"[DIAG] Querying price_logs for {len(hotel_ids_list)} hotel_ids since {cutoff_date[:10]}")
    
    price_logs_res = db.table("price_logs") \
        .select("*") \
        .in_("hotel_id", hotel_ids_list) \
        .gte("recorded_at", cutoff_date) \
        .order("recorded_at", desc=True) \
        .execute()
    logs_data = price_logs_res.data or []
    
    # DIAGNOSTIC: Log price_logs count and sample data
    logger.info(f"[DIAG] User {user_id}: Found {len(logs_data)} price_logs in 90-day window")
    if logs_data:
        sample = logs_data[0]
        logger.info(f"[DIAG] Latest log: hotel_id={str(sample.get('hotel_id','?'))[:8]}, price={sample.get('price')}, currency={sample.get('currency')}, room_types_count={len(sample.get('room_types') or [])}, recorded_at={str(sample.get('recorded_at','?'))[:19]}")
    else:
        # SAFEGUARD: query_logs fallback
        # If price_logs is empty (e.g. after accidental deletion), pull historical
        # prices from query_logs which is never deleted. This ensures the dashboard
        # always shows data as long as any scan has ever run.
        logger.warning(f"[SAFEGUARD] No price_logs found. Falling back to query_logs for user {user_id}")
        
        # Build hotel name -> id mapping for query_logs (which stores hotel_name, not hotel_id)
        hotel_name_to_id = {}
        for h in hotels:
            hotel_name_to_id[h["name"].lower().strip()] = str(h["id"])
        
        ql_res = db.table("query_logs") \
            .select("hotel_name, price, currency, vendor, created_at, check_in_date") \
            .eq("user_id", str(user_id)) \
            .gte("created_at", cutoff_date) \
            .order("created_at", desc=True) \
            .execute()
        
        fallback_count = 0
        for ql in (ql_res.data or []):
            price = ql.get("price")
            if not price or float(price) <= 0:
                continue
            
            ql_name = (ql.get("hotel_name") or "").lower().strip()
            hotel_id = hotel_name_to_id.get(ql_name)
            if not hotel_id:
                # Partial name match fallback
                for name, hid in hotel_name_to_id.items():
                    if ql_name in name or name in ql_name:
                        hotel_id = hid
                        break
            if not hotel_id:
                continue
            
            logs_data.append({
                "hotel_id": hotel_id,
                "price": float(price),
                "currency": ql.get("currency") or "TRY",
                "vendor": ql.get("vendor") or "Unknown",
                "source": "serpapi",
                "check_in_date": ql.get("check_in_date") or ql.get("created_at", "")[:10],
                "recorded_at": ql.get("created_at"),
                "is_estimated": False,
                "parity_offers": [],
                "room_types": [],
                "metadata": {"source": "query_logs_fallback"}
            })
            fallback_count += 1
        
        logger.info(f"[SAFEGUARD] Recovered {fallback_count} price entries from query_logs")
    
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
        # Improved: check if it CONTAINS standard/standart
        is_std = any(s in room_type.lower() for s in ["standard", "standart"])
        if not catalog_res.data and is_std:
            # Try searching for the other variant specifically
            alt = "standart" if "standard" in room_type.lower() else "standard"
            catalog_res = db.table("room_type_catalog").select("embedding") \
                .ilike("normalized_name", f"%{alt}%").limit(1).execute()

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
