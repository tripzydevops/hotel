"""
Analysis Service
Handles complex market analysis, room type matching, and sentiment data processing.
"""
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger replaces raw print() for structured output
logger = get_logger(__name__)

import math
import re
from datetime import datetime, date, timedelta, timezone
import asyncio
import os
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
        # Convert allowed_names to lowercase set for O(1) case-insensitive lookup
        allowed_lower = {a.lower().strip() for a in allowed_names}
        for r in r_types:
            if isinstance(r, dict):
                r_name = r.get("name", "")
                if r_name.lower().strip() in allowed_lower:
                  # KAIZEN: "Strict Category Guards"
                  # We ensure that a match actually belongs to the requested category.
                  r_name = r.get("name", "")
                  t_lower = target_room_type.lower()
                  r_lower = r_name.lower()
                  
                  is_standard_t = any(s in t_lower for s in ["standard", "standart"])
                  is_standard_r = any(s in r_lower for s in ["standard", "standart"])

                  # 1. Suite Guard: If asking for Suite, offer MUST have "suite" or "süit"
                  if "suite" in t_lower and not any(k in r_lower for k in ["suite", "süit"]):
                      continue
                      
                  # 2. Deluxe Guard: If asking for Deluxe, reject plain Standard rooms
                  if any(k in t_lower for k in ["deluxe", "superior", "premium"]) and is_standard_r and "deluxe" not in r_lower:
                      continue

                  # 3. Standard Leak Guard: If asking for specific non-standard type, reject plain Standard
                  if not is_standard_t and is_standard_r:
                      # Exception: "Standard Suite" is fine if asking for Suite
                      if not ("suite" in t_lower and "suite" in r_lower):
                          continue

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
    # Kaizen: Add Deluxe/Superior synonyms
    if any(k in target_room_type.lower() for k in ["deluxe", "superior", "premium"]):
         target_variants.extend(["deluxe", "superior", "premium", "corner"])
    # Kaizen: Add Family synonyms
    if any(k in target_room_type.lower() for k in ["family", "aile"]):
         target_variants.extend(["family", "aile", "connection", "connected", "bağlantılı"])
    
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
             # Apply guards even to substring matches
             if "suite" in target_room_type.lower() and not any(k in c_name for k in ["suite", "süit"]):
                 continue
             return _extract_price(r.get("price")), r.get("name") or "Standard", 0.9

        # Priority 3: Name Substring Match
        if any(v in r_name for v in target_variants):
            # Apply guards: If asking for Suite/Deluxe, don't match a plain Standard
            t_low = target_room_type.lower()
            is_std_t = any(s in t_low for s in ["standard", "standart"])
            is_std_r = any(s in r_name for s in ["standard", "standart"])
            
            if "suite" in t_low and not any(k in r_name for k in ["suite", "süit"]):
                continue
            if not is_std_t and is_std_r and "deluxe" not in r_name and "superior" not in r_name:
                continue
            
            return _extract_price(r.get("price")), r.get("name") or "Standard", 0.85
            
    # --- FALLBACK LOGIC ---
    
    # 1. Define Request Type (Standard vs Specific)
    # We treat it as a Standard request if the prompt is empty or contains base keywords (Standard, Classic, etc.)
    # and DOES NOT contain specific premium keywords (Suite, Deluxe, Family).
    target_low = target_room_type.lower().strip()
    is_premium = any(k in target_low for k in ["suite", "süit", "deluxe", "superior", "premium", "family", "aile", "balcony", "view"])
    is_base = not target_low or target_low == "oda" or any(v in target_low for v in ["standard", "standart", "base", "klasik", "classic", "eco", "promo"])
    
    # A request is "Standard" if it's explicitly base OR empty, and NOT specifically premium.
    is_standard_request = (is_base and not is_premium) or not target_room_type

    # KAIZEN: "Premium Shield"
    # Even if is_standard_request is True, we must ensure the candidate room 
    # doesn't contain heavy premium keywords that might have been miscategorized.
    premium_shields = ["presidential", "başkanlık", "kral", "king suite", "queen suite", "balayı", "honeymoon", "dubleks", "duplex"]

    # 2. Standard Fallback: Lowest price in room_types (for Standard requests only)
    if is_standard_request and r_types:
        valid_prices = []
        for r in r_types:
            if not isinstance(r, dict): continue
            r_name = (r.get("name") or "").lower()
            
            # Skip rooms that hit the premium shield
            if any(k in r_name for k in premium_shields):
                continue
                
            p = _extract_price(r.get("price"))
            if p is not None:
                valid_prices.append((p, r.get("name") or "Standard (Min)"))
        if valid_prices:
            valid_prices.sort(key=lambda x: x[0])
            return valid_prices[0][0], valid_prices[0][1], 0.65

    # 3. Legacy Fallback: Top-level price if rooms are empty (for Standard requests only)
    if is_standard_request and not r_types:
        top_p = _extract_price(price_log.get("price"))
        if top_p is not None and top_p > 0:
            return top_p, "Standard (Legacy)", 0.7

    # 4. Final Fail: If we reach here, we have no specific room match.
    # We return None to indicate no data for this specific room type, preventing leakage.
    return None, None, 0.0


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

# EXPLANATION: Vercel-Safe Lazy Loader
# Why: Vercel serverless environments may not always have the heavy genai SDK 
# installed if it's not in the root requirements. This lazy loader prevents 
# top-level import crashes, ensuring the rest of the API remains functional.
_genai_client = None

def get_genai_client():
    global _genai_client
    if _genai_client is None:
        try:
            from google import genai
            api_key = os.getenv("GOOGLE_API_KEY")
            if api_key:
                _genai_client = genai.Client(api_key=api_key)
        except ImportError:
            logger.warning("[AI] google-genai SDK missing. Falling back to heuristics.")
    return _genai_client

async def stream_narrative_gen(analysis_data: Dict[str, Any]):
    """
    KAIZEN: Streaming Narrative Producer
    Uses Gemini to generate a data-driven market insight trace.
    """
    hotel_name = analysis_data.get("hotel_name")
    ari = analysis_data.get("ari")
    sent_index = analysis_data.get("sent_index")
    dna_text = analysis_data.get("pricing_dna_text")
    q_label = analysis_data.get("quadrant_label")
    
    prompt = f"""
    You are a Strategic Revenue Analyst for {hotel_name}. 
    Market Context:
    - Market Position: {q_label}
    - ARI (Price Index): {ari} (100 is market average)
    - Sentiment Index: {sent_index} (100 is market average)
    - DNA Strategy: {dna_text or 'None defined'}
    
    Task:
    Provide a concise (2-3 sentences) strategic "So What?" verdict. 
    Focus on the correlation between price position and guest sentiment. 
    Do not use placeholders. Be direct and professional.
    """
    
    try:
        client = get_genai_client()
        if not client:
            # Fallback to heuristic if no client or no API key
            yield generate_synthetic_narrative(ari, sent_index, dna_text, hotel_name)
            return

        # EXPLANATION: Modern Streaming with google-genai
        # We use client.models.generate_content_stream for the 2026 standard.
        response = client.models.generate_content_stream(
            model='gemini-3-flash-preview',
            contents=prompt,
        )
        
        for chunk in response:
            if chunk.text:
                yield chunk.text
                await asyncio.sleep(0.05) # Subtle pacing for UX
                
    except Exception as e:
        logger.error(f"[SSE] AI Narrative failed with modern SDK: {e}")
        yield generate_synthetic_narrative(ari, sent_index, dna_text, hotel_name)


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
    # [KAIZEN] Consistent Target Selection: We pick the FIRST target hotel 
    # encountered in the sorted list to ensure it matches the ID used for log mapping.
    for hotel in hotels:
        hid = str(hotel["id"])
        hotel_rating = float(hotel.get("rating") or 0.0)
        reviews = int(hotel.get("review_count") or 0)
        
        weight = math.log10(reviews + 10) / 2.0 
        weighted_sentiment = hotel_rating * weight
        market_sentiments.append(weighted_sentiment)
        
        if hotel.get("is_target_hotel") and not target_hotel_id:
            target_hotel_id = hid
            target_hotel_name = hotel.get("name") or "Unknown"
            target_sentiment = weighted_sentiment

    # EXPLANATION: Target Hotel Auto-Select Fallback
    # If no hotel has is_target_hotel=True (common for new users who haven't 
    # configured their target yet), we auto-select the first hotel in their list.
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

    # 2.5 Build Competitors List (Needed for Calendar Columns & Continuity)
    # EXPLANATION: All-inclusive Competitor List 
    # We include EVERY tracked competitor in the top-level list, even if their latest scan
    # matched no price for the current filter. This ensures the Rate Intelligence Grid
    # always has columns for all competitors, even if some cells show "-" or "N/A".
    comp_list = []
    for h in hotels:
        hid_str = str(h["id"])
        if hid_str == target_hotel_id:
            continue
            
        p = hotel_prices_map.get(hid_str, [])
        latest_comp_price = None
        c_room = None
        c_score = 0.0
        
        if p:
            try:
                latest_p, latest_room, latest_score = get_price_for_room(p[0], room_type, allowed_room_names_map)
                if latest_p is not None:
                    latest_comp_price = convert_currency(latest_p, p[0].get("currency") or "USD", display_currency)
                    c_room = latest_room
                    c_score = latest_score
            except Exception as ce:
                logger.warning(f"Failed to extract latest price for competitor {h.get('name')}: {ce}")

        comp_list.append({
            "id": hid_str,
            "name": h.get("name"),
            "price": latest_comp_price, # Might be None, Grid handles this
            "rating": h.get("rating"),
            "offers": p[0].get("parity_offers") or p[0].get("offers") or [] if p else [],
            "matched_room": c_room,
            "match_score": c_score
        })

    # 3. Build Daily Prices for Calendar (Smart Continuity)
    daily_prices: List[Dict[str, Any]] = []
    if target_hotel_id:
        # EXPLANATION: Smart Continuity (Read-Time Vertical Fill)
        # We group logs by hotel and check-in date. For each date:
        # 1. We take the latest scan result.
        # 2. If it failed (price=0 or None), we look back at previous scans for that SAME check-in date.
        # 3. If a successful scan is found within history, we use it and mark as 'Estimated'.
        date_price_map: Dict[str, Dict[str, Any]] = {}

        today_date = date.today()
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
                    date_price_map[d_str] = {
                        "target": None, 
                        "target_is_estimated": False, 
                        "target_intraday": [],
                        "competitors": []
                    }
                
                # EXPLANATION: Intraday Event Collection
                # We collect ALL unique successful scan prices for this check-in date
                # to show the "price story" of the day in the UI.
                intraday_events = []
                seen_intraday = set()
                
                # [KAİZEN] Multi-Vendor Price Extraction
                # Why: A single scan often finds multiple vendors with different prices.
                # Previously, we only added the LEAD price. Now we include all vendors
                # from the parity_offers/offers arrays to show a richer price story.
                for l in logs:
                    # 1. Primary Matched Price
                    lp, _, _ = get_price_for_room(l, room_type, allowed_room_names_map)
                    if lp and lp > 0:
                        rounded_lp = round(float(lp), 2)
                        if rounded_lp not in seen_intraday:
                            intraday_events.append({
                                "price": rounded_lp,
                                "recorded_at": l.get("recorded_at"),
                                "vendor": l.get("vendor") or "Primary"
                            })
                            seen_intraday.add(rounded_lp)
                    
                    # 2. Secondary Vendor Prices (Parity)
                    # We only extract parity prices for "Standard" requests to avoid
                    # mixing premium room prices with standard parity data.
                    is_std_req = not room_type or any(s in room_type.lower() for s in ["standard", "standart"])
                    if is_std_req:
                        other_offers = l.get("parity_offers") or l.get("offers") or []
                        for offer in other_offers:
                            op = _extract_price(offer.get("price"))
                            if op and op > 0:
                                rounded_op = round(float(op), 2)
                                if rounded_op not in seen_intraday:
                                    intraday_events.append({
                                        "price": rounded_op,
                                        "recorded_at": l.get("recorded_at"),
                                        "vendor": offer.get("vendor") or "Other"
                                    })
                                    seen_intraday.add(rounded_op)

                # 1. Analyze the logs for this specific check-in date
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

                # 2. Global Fallback for this Hotel (Any-Date Continuity) - RESTRICTED
                # Why: We only use cross-date continuity for dates in the past or today.
                # For future dates, we ONLY show data if a scan exists for that specific check-in date.
                # KAİZEN: Re-enabled for all types, but strict matching in get_price_for_room 
                # prevents Standard leakage into non-Standard views.
                if (price_val is None or price_val <= 0) and datetime.strptime(d_str, "%Y-%m-%d").date() <= today_date:
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
                        date_price_map[d_str]["target_intraday"] = intraday_events
                    else:
                        date_price_map[d_str]["competitors"].append({
                            "name": hotel_name, 
                            "price": converted_price,
                            "is_estimated": is_est,
                            "intraday_events": intraday_events
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
        # EXPLANATION: Relative-Date Continuity Seeding
        # We find the most recent scan BEFORE our window starts to avoid the "sticky price"
        # issue where navigating backwards still shows today's prices.
        last_known_target = None
        target_logs = hotel_prices_map.get(target_hotel_id, [])
        for log in target_logs:
            log_date = str(log.get("check_in_date", "")).split('T')[0]
            if log_date <= range_start.strftime("%Y-%m-%d"):
                lp, _, _ = get_price_for_room(log, room_type, allowed_room_names_map)
                if lp and lp > 0:
                    last_known_target = convert_currency(lp, log.get("currency") or "USD", display_currency)
                    break
        
        # If still None, fall back to the very latest known price for this room_type
        if last_known_target is None:
            last_known_target = target_price
        # Relative Seeding for Competitors
        # We find the most recent scan for each competitor BEFORE our window starts.
        competitor_states: Dict[str, Dict[str, Any]] = {}
        for h in hotels:
            if str(h["id"]) == target_hotel_id: continue
            h_name = h.get("name")
            h_logs = hotel_prices_map.get(str(h["id"]), [])
            for log in h_logs:
                log_date = str(log.get("check_in_date", "")).split('T')[0]
                if log_date <= range_start.strftime("%Y-%m-%d"):
                    lp, _, _ = get_price_for_room(log, room_type, allowed_room_names_map)
                    if lp and lp > 0:
                        competitor_states[h_name] = {
                            "price": convert_currency(lp, log.get("currency") or "USD", display_currency),
                            "is_estimated": True
                        }
                        break
                        
        # Fallback to comp_list (latest overall) for any competitors still missing
        for c in comp_list:
            if c["name"] not in competitor_states:
                competitor_states[c["name"]] = {"price": c["price"], "is_estimated": True}
        
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
                # [KAİZEN] Carry forward ONLY for past/today to fill gaps in historical records.
                # For future dates, we leave it empty if no specific scan exists.
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
            
            # Horizontal Continuity (Competitor Fill) - RESTRICTED TO PAST/TODAY
            for name, state in competitor_states.items():
                if name not in seen_competitors:
                    # Carry competitor prices forward ONLY for past/today dates.
                    if current_date <= today_date:
                        unique_competitors.append({
                            "name": name,
                            "price": state["price"],
                            "is_estimated": True 
                        })
                        seen_competitors.add(name)
            
            if unique_competitors:
                valid_comp_prices = [float(c["price"]) for c in unique_competitors if c.get("price") is not None]
                if valid_comp_prices:
                    comp_avg = sum(valid_comp_prices) / len(valid_comp_prices)
                
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
                "intraday_events": data.get("target_intraday", []) if data else [],
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
    
    # EXPLANATION: Market Sentiment Average Calculation
    # We aggregate sentiment scores across all tracked hotels to provide 
    # a market baseline for the Discovery Engine and Audit reports.
    market_avg_scores: Dict[str, float] = {}
    pillar_totals: Dict[str, List[float]] = {}
    
    for h in hotels:
        bd = h.get("sentiment_breakdown")
        if isinstance(bd, list):
            for pillar in bd:
                if not isinstance(pillar, dict): continue
                p_name = pillar.get("name")
                p_score = pillar.get("score")
                if p_name and p_score is not None:
                    if p_name not in pillar_totals: pillar_totals[p_name] = []
                    pillar_totals[p_name].append(float(p_score))
    
    for p_name, scores in pillar_totals.items():
        market_avg_scores[p_name] = sum(scores) / len(scores) if scores else 0.0

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
    
    # EXPLANATION: Deterministic Hotel Ordering (Deduplication Guard)
    # Why: If multiple local records share the same serp_api_id, we MUST ensure 
    # all analysis and mapping logic picks the SAME record (the active target).
    # We sort by is_target_hotel DESC, then updated_at DESC.
    hotels.sort(key=lambda x: (bool(x.get("is_target_hotel")), x.get("updated_at", "")), reverse=True)

    # DIAGNOSTIC: Log hotel count for this user
    logger.info(f"[DIAG] User {user_id}: Found {len(hotels)} hotels")
    
    if not hotels:
        logger.warning(f"[DIAG] User {user_id}: No hotels found, returning empty")
        return {"summary": {}, "hotels": []}

    # EXPLANATION: Time-Windowed Price Fetching (replaces limit(5000))
    # A 90-day rolling window is more predictable than a fixed row count.
    # As data grows, limit(5000) would either miss data or cause memory spikes.
    # The time window scales linearly with calendar time, not data volume.
    cutoff_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
    
    # EXPLANATION: Global Price Retrieval (Pillar of Global Pulse)
    # We now fetch prices based on BOTH local hotel_id and global serp_api_id.
    # This ensures that as long as ANY user scans a hotel, EVERY user tracking it 
    # gets the fresh data in their Rate Calendar.
    hotel_ids_list = [str(h["id"]) for h in hotels]
    serp_ids_list = [h.get("serp_api_id") for h in hotels if h.get("serp_api_id")]
    
    logger.info(f"[DIAG] User {user_id}: Querying price_logs for {len(hotel_ids_list)} local IDs and {len(serp_ids_list)} global IDs since {cutoff_date[:10]}")
    
    # Building a combined OR query is complex in postgrest, so we fetch both and merge
    # Step 1: Local ID logs
    price_logs_res = db.table("price_logs") \
        .select("*") \
        .in_("hotel_id", hotel_ids_list) \
        .gte("recorded_at", cutoff_date) \
        .order("recorded_at", desc=True) \
        .execute()
    logs_data = price_logs_res.data or []
    
    # Step 2: Global ID logs (Pulse Data)
    if serp_ids_list:
        global_logs_res = db.table("price_logs") \
            .select("*") \
            .in_("serp_api_id", serp_ids_list) \
            .gte("recorded_at", cutoff_date) \
            .order("recorded_at", desc=True) \
            .execute()
        
        # Merge global logs, ensuring we don't have duplicates
        existing_log_ids = {l["id"] for l in logs_data}
        for g_log in (global_logs_res.data or []):
            if g_log["id"] not in existing_log_ids:
                logs_data.append(g_log)
    
    # Map logs back to local hotel IDs for grouping
    # Rationale: A global log will have its own hotel_id, but for our user's
    # analysis, we must map it to OUR local hotel_id that shares the same serp_api_id.
    # [KAIZEN] Robust ID Mapping: We pick the FIRST matching hotel from our sorted 
    # list to ensure consistency when duplicates exist.
    serp_to_local_map = {}
    for h in hotels:
        sid = h.get("serp_api_id")
        if sid and sid not in serp_to_local_map:
            serp_to_local_map[sid] = str(h["id"])
    
    for log in logs_data:
        # If the log's hotel_id isn't in our local list, but its serp_api_id matches one of ours
        if str(log.get("hotel_id")) not in hotel_ids_list:
            local_id = serp_to_local_map.get(log.get("serp_api_id"))
            if local_id:
                log["hotel_id"] = local_id # Map to local
    
    # DIAGNOSTIC: Log price_logs count and sample data
    logger.info(f"[DIAG] User {user_id}: Combined {len(logs_data)} price_logs including global data")
    
    # SAFEGUARD: Proactive query_logs integration
    # We pull query_logs if:
    # 1. Our dataset is "thin" (< 5 logs per hotel)
    # 2. The requested range (start_date) is older than our 90-day price_logs window
    is_historical_request = False
    if start_date:
        try:
            s_dt = datetime.fromisoformat(str(start_date).split('T')[0])
            if s_dt < datetime.fromisoformat(cutoff_date.split('T')[0]):
                is_historical_request = True
        except: pass

    if is_historical_request or len(logs_data) < (len(hotels) * 5):
        logger.info(f"[SAFEGUARD] Pulling historical query_logs for user {user_id} (Historical={is_historical_request}, Thin={len(logs_data)})")
        
        hotel_name_to_id = {h["name"].lower().strip(): str(h["id"]) for h in hotels}
        fallback_cutoff = (datetime.utcnow() - timedelta(days=180)).isoformat()
        
        ql_res = db.table("query_logs") \
            .select("hotel_name, price, currency, vendor, created_at, check_in_date") \
            .eq("user_id", str(user_id)) \
            .gte("created_at", fallback_cutoff) \
            .order("created_at", desc=True) \
            .execute()
        
        fallback_count = 0
        existing_combos = {(str(l["hotel_id"]), l.get("check_in_date"), l.get("price")) for l in logs_data}

        for ql in (ql_res.data or []):
            price = ql.get("price")
            if not price or float(price) <= 0: continue
            
            ql_name = (ql.get("hotel_name") or "").lower().strip()
            hotel_id = hotel_name_to_id.get(ql_name)
            if not hotel_id:
                for name, hid in hotel_name_to_id.items():
                    if ql_name in name or name in ql_name:
                        hotel_id = hid; break
            
            if not hotel_id: continue
            check_in = ql.get("check_in_date") or ql.get("created_at", "")[:10]
            
            # Avoid duplicate data if already in price_logs
            if (hotel_id, check_in, float(price)) in existing_combos: continue

            fallback_count += 1
            logs_data.append({
                "hotel_id": hotel_id,
                "price": float(price),
                "currency": ql.get("currency") or "TRY",
                "vendor": "Unknown",
                "source": "serpapi",
                "check_in_date": check_in,
                "recorded_at": ql.get("created_at"),
                "is_estimated": False,
                "parity_offers": [],
                "room_types": [],
                "metadata": {"source": "query_logs_fallback"}
            })
        logger.info(f"[SAFEGUARD] Recovered {fallback_count} additional entries from query_logs.")
        
    # FINAL FALLBACK: Latest Price from Hotels table (Only for Standard requests)
    # Why: If the user is exploring specific categories like 'Suite' and we have NO data,
    # it is better to show 'N/A' (None) than to seed with misleading 'Standard' prices.
    is_std = not room_type or any(v in room_type.lower() for v in ["standard", "standart", "any", "base"])
    if is_std and (not logs_data or len(logs_data) < len(hotels)):
        logger.warning(f"[SAFEGUARD] Seeding from hotels table current_price for standard request (user {user_id})")
        for h in hotels:
            lp = h.get("current_price") or 0.0
            if float(lp) > 0:
                for i in range(14):
                    target_date = (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d")
                    logs_data.append({
                        "hotel_id": str(h["id"]),
                        "price": float(lp),
                        "currency": h.get("currency") or h.get("preferred_currency") or "TRY",
                        "vendor": "Cached",
                        "source": "hotels_table",
                        "check_in_date": target_date,
                        "recorded_at": h.get("updated_at") or datetime.now().isoformat(),
                        "is_estimated": True,
                        "parity_offers": [],
                        "room_types": [],
                        "metadata": {"source": "hotels_table_fallback"}
                    })
    
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
        # EXPLANATION: Smart Catalog Search
        # We first try to find the exact embedding for the requested room type.
        # If that fails, we extract core keywords (Suite, Deluxe, Family) 
        # to find the best representative embedding from the catalog.
        catalog_res = db.table("room_type_catalog").select("embedding") \
            .ilike("normalized_name", f"%{room_type}%").limit(1).execute()
        
        if not catalog_res.data:
            # Keyword-based fallback search in catalog
            keywords = []
            rt_low = room_type.lower()
            if "suite" in rt_low or "süit" in rt_low: keywords.append("Suite")
            elif any(k in rt_low for k in ["deluxe", "superior", "premium"]): keywords.append("Deluxe")
            elif any(k in rt_low for k in ["family", "aile"]): keywords.append("Family")
            
            if keywords:
                catalog_res = db.table("room_type_catalog").select("embedding") \
                    .in_("normalized_name", keywords).limit(1).execute()

        # Fallback for Standard/Standart mismatch in catalog
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
