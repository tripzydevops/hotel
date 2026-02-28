"""
=============================================================================
SENTIMENT UTILS — Sentiment Transformation & Intelligence Utilities
=============================================================================

PURPOSE:
    This module bridges the gap between raw, unstructured hotel review data
    scraped from Google (via SerpApi) and the structured, multi-dimensional
    analytics that the frontend Sentiment Analysis page expects.

WHO USES THIS:
    - AnalystAgent (backend/agents/analyst_agent.py) — calls normalize_sentiment,
      generate_mentions, merge_sentiment_breakdowns after each scan
    - DashboardService (backend/services/dashboard_service.py) — calls
      synthesize_value_score when building the dashboard response
    - MonitorService (backend/services/monitor_service.py) — imports this
      module transitively via AnalystAgent (CRITICAL: if this file has a
      syntax error, the entire scheduler import chain crashes!)

KEY CONCEPTS:
    - TR_MAP: Turkish → English keyword translation dictionary
    - Four Pillars: The UI always expects exactly 4 categories:
      Cleanliness, Service, Location, Value
    - Smart Memory: Historical sentiment data is preserved via cumulative
      merge rather than overwritten on each scan

IMPORT CHAIN (for debugging):
    run_scheduler.py → monitor_service.py → analyst_agent.py → THIS FILE
    A syntax error here will silently kill all scheduled scans.
=============================================================================
"""

from typing import List, Dict, Any, Optional


# =============================================================================
# TR_MAP — Turkish-to-English Keyword Translation Dictionary
# =============================================================================
# EXPLANATION: Google Reviews returns category names in the hotel's locale.
# Turkish hotels return names like "Hizmet" (Service), "Temizlik" (Cleanliness).
# This map normalizes them to English for consistent frontend display.
#
# NOTE: Some keys appear duplicated (e.g., "mutfak", "otopark") — this is
# intentional as Python dicts silently keep the last value, and the duplicates
# serve as documentation of the mapping intent.
# =============================================================================
TR_MAP = {
    # --- Core Hotel Categories ---
    "hizmet": "Service",  # Guest service quality
    "temizlik": "Cleanliness",  # Room/facility cleanliness
    "konum": "Location",  # Geographic location & accessibility
    "oda": "Room",  # Individual room quality
    "kahvaltı": "Breakfast",  # Breakfast offering
    "fiyat": "Price",  # Price perception
    "değer": "Value",  # Value-for-money perception
    "personel": "Staff",  # Staff attitude & professionalism
    "mülk": "Property",  # Overall property condition
    # --- Room & Comfort ---
    "uyku": "Sleep",  # Sleep quality
    "banyo": "Bathroom",  # Bathroom condition
    "konfor": "Comfort",  # General comfort level
    "yatak": "Bed",  # Bed quality
    "klima": "A/C",  # Air conditioning
    "odalar": "Rooms",  # Rooms (plural variant)
    "sessizlik": "Quietness",  # Noise level
    # --- Food & Beverage ---
    "yemek": "Food",  # Food quality
    "restoran": "Restaurant",  # Restaurant experience
    "bar": "Bar",  # Bar service
    "mutfak": "Kitchen",  # Kitchen facilities
    "dining": "Dining",  # English variant for dining
    # --- Facilities & Amenities ---
    "havuz": "Pool",  # Swimming pool
    "fitness": "Fitness",  # Gym/fitness center
    "sağlıklı yaşam": "Wellness",  # Spa & wellness
    "bahçe": "Garden",  # Garden area
    "teras": "Terrace",  # Terrace/balcony
    "tesisler": "Facilities",  # General facilities
    "otopark": "Parking",  # Parking availability
    # --- Connectivity ---
    "kablosuz": "Wi-Fi",  # Wi-Fi quality
    "internet": "Internet",  # Internet (generic)
    # --- Service & Front Desk ---
    "resepsiyon": "Reception",  # Front desk experience
    "atmosfer": "Atmosphere",  # Hotel atmosphere/ambiance
    "güvenlik": "Security",  # Safety & security
    "manzara": "View",  # View from hotel
    "ulaşım": "Transport",  # Transportation access
    "erişilebilirlik": "Accessibility",  # Disability access
    "gece hayatı": "Nightlife",  # Nearby nightlife
    # --- Guest Demographics (used in traveler type tags) ---
    "aile": "Family",  # Family travelers
    "çiftler": "Couples",  # Couples
    "iş": "Business",  # Business travelers
    "yalnız": "Solo",  # Solo travelers
    "arkadaşlar": "Friends",  # Friend groups
    # --- Quality Descriptors ---
    "modern": "Modern",  # Modern property
    "lüks": "Luxury",  # Luxury segment
    "ekonomik": "Budget",  # Budget segment
}


def normalize_sentiment(breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Standardizes diverse sentiment categories into four core UI pillars.

    PROBLEM: Google Reviews returns 10-30 locale-specific categories per hotel
    (e.g., 'Uyku', 'Hizmet', 'Dining', 'Kahvaltı'). The frontend Sentiment
    Analysis page expects exactly 4 standardized pillars.

    SOLUTION: Maps all categories into 4 pillars using keyword substring matching,
    accumulating counts from multiple source categories into each pillar.

    FOUR PILLARS:
        1. Cleanliness — rooms, bathroom, hygiene, sleep, comfort, facilities
        2. Service     — staff, reception, breakfast, dining, spa, pool
        3. Location    — geography, view, transport, parking, nightlife
        4. Value       — price, cost, quality, budget, deals

    RATING FORMULA:
        rating = (positive * 5 + neutral * 3 + negative * 1) / total_mentioned
        Range: 1.0 to 5.0 (same scale as Google Reviews stars)

    Returns:
        List of exactly 4 dicts, one per pillar, always in the same order.
        Missing pillars get a fallback rating based on the average of found ones.
    """
    if breakdown is None:
        breakdown = []

    if not isinstance(breakdown, list):
        return []

    # EXPLANATION: Initialize all 4 pillars with zero counts.
    # Even if a pillar has no matching categories, it still appears in the output
    # with is_estimated=True so the UI can show it with a fallback value.
    pillars = {
        "Cleanliness": {"positive": 0, "negative": 0, "neutral": 0, "total": 0},
        "Service": {"positive": 0, "negative": 0, "neutral": 0, "total": 0},
        "Location": {"positive": 0, "negative": 0, "neutral": 0, "total": 0},
        "Value": {"positive": 0, "negative": 0, "neutral": 0, "total": 0},
    }

    # EXPLANATION: Keyword-to-pillar mapping using substring matching.
    # A category like "Oda Temizliği" (Room Cleanliness) will match "temizlik"
    # and be routed to the Cleanliness pillar. The first match wins (break).
    mappings = {
        "Cleanliness": [
            "temizlik",
            "cleanliness",
            "oda",
            "room",
            "banyo",
            "bathroom",
            "hijyen",
            "hygiene",
            "housekeeping",
            "uyku",
            "sleep",
            "yatak",
            "bed",
            "mülk",
            "property",
            "tesis",
            "facility",
            "konfor",
            "comfort",
            "klima",
            "air conditioning",
            "internet",
            "wifi",
            "kablosuz",
            "odalar",
            "tesisler",
        ],
        "Service": [
            "hizmet",
            "service",
            "personel",
            "staff",
            "ilgi",
            "reception",
            "resepsiyon",
            "kahvaltı",
            "breakfast",
            "karşılama",
            "welcoming",
            "dining",
            "yemek",
            "restoran",
            "restaurant",
            "food",
            "yiyecek",
            "içecek",
            "bar",
            "atmosfer",
            "atmosphere",
            "sağlıklı yaşam",
            "spa",
            "wellness",
            "pool",
            "havuz",
            "fitness",
            "sauna",
            "mutfak",
            "kitchen",
            "servis",
        ],
        "Location": [
            "konum",
            "location",
            "yer",
            "place",
            "manzara",
            "view",
            "ulaşım",
            "access",
            "çevre",
            "neighborhood",
            "merkez",
            "gece hayatı",
            "nightlife",
            "otopark",
            "parking",
            "transport",
            "trafik",
            "traffic",
            "bahçe",
            "garden",
            "teras",
            "terrace",
        ],
        "Value": [
            "fiyat",
            "price",
            "değer",
            "value",
            "fiyat-performans",
            "cost",
            "ucuzluk",
            "maliyet",
            "ekonomik",
            "pahalı",
            "para",
            "money",
            "affordable",
            "ucuz",
            "pahalı",
            "kalite",
            "quality",
            "fırsat",
            "teklif",
            "deal",
            "offer",
            "bütçe",
            "budget",
        ],
    }

    found_pillars = set()

    # EXPLANATION: Iterate through every raw category from Google Reviews
    # and accumulate its counts into the matching pillar.
    for item in breakdown:
        name = item.get("name", "").lower()
        pos = int(item.get("positive") or 0)
        neg = int(item.get("negative") or 0)
        neu = int(item.get("neutral") or 0)
        total = int(item.get("total_mentioned") or 0)

        for pillar, keywords in mappings.items():
            if any(kw in name for kw in keywords):
                pillars[pillar]["positive"] += pos
                pillars[pillar]["negative"] += neg
                pillars[pillar]["neutral"] += neu
                pillars[pillar]["total"] += total

                # EXPLANATION: Keep the best description for each pillar.
                # "Best" = from the category with the most total mentions,
                # since that's likely the most representative description.
                current_description = item.get("description") or item.get("summary")
                if current_description and (
                    not pillars[pillar].get("description")
                    or total > pillars[pillar].get("_max_total", 0)
                ):
                    pillars[pillar]["description"] = current_description
                    pillars[pillar]["_max_total"] = total

                found_pillars.add(pillar)
                break

    # EXPLANATION: Calculate a baseline rating from found pillars.
    # This is used as a fallback for pillars that had zero matching categories.
    # Example: if Cleanliness=4.2 and Service=4.0 are found but Location is not,
    # Location gets baseline (4.1) minus a small penalty (0.2) = 3.9
    result = []
    total_found_rating = 0
    num_found = 0
    for name in ["Cleanliness", "Service", "Location", "Value"]:
        stats = pillars[name]
        if stats["total"] > 0:
            total_found_rating += (
                stats["positive"] * 5 + stats["neutral"] * 3 + stats["negative"] * 1
            ) / stats["total"]
            num_found += 1

    baseline = round(total_found_rating / num_found, 1) if num_found > 0 else 4.0

    # EXPLANATION: Build the final output list. Always returns exactly 4 items
    # in fixed order so the UI can render them consistently.
    for name in ["Cleanliness", "Service", "Location", "Value"]:
        stats = pillars[name]
        pos = stats["positive"]
        neg = stats["negative"]
        neu = stats["neutral"]
        total = stats["total"]

        # EXPLANATION: Rating calculation uses weighted scoring:
        # positive=5 stars, neutral=3 stars, negative=1 star, then averaged.
        if total > 0:
            rating = (pos * 5 + neu * 3 + neg * 1) / total
        else:
            # Fallback: use average of other pillars minus slight penalty.
            # Floor at 3.5 to avoid unreasonably low estimated scores.
            rating = max(3.5, baseline - 0.2)

        result.append(
            {
                "name": name,
                "rating": round(rating, 1),
                "positive": pos,
                "negative": neg,
                "neutral": neu,
                "total_mentioned": total,
                "description": stats.get("description"),
                "is_estimated": total
                == 0,  # EXPLANATION: UI shows a "~" indicator for estimated pillars
            }
        )

    return result


def translate_breakdown(breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Translates raw Turkish category names to English display labels.

    Unlike normalize_sentiment() which collapses everything into 4 pillars,
    this function preserves the original category variety (10-30 items) and
    just adds a 'display_name' field with the English translation.

    Used by: Frontend tooltip displays and detailed breakdown views.
    """
    if not breakdown or not isinstance(breakdown, list):
        return []

    translated = []
    for item in breakdown:
        name = item.get("name", "")
        # EXPLANATION: Try exact match first, then substring match against TR_MAP.
        # This handles both "hizmet" (exact) and "Otel Hizmeti" (substring).
        label = name
        for tr_key, en_val in TR_MAP.items():
            if tr_key == name.lower() or tr_key in name.lower():
                label = en_val
                break

        translated.append(
            {
                **item,  # Keep all original fields intact
                "display_name": label,  # Add English display name
            }
        )
    return translated


def generate_mentions(breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Synthesizes 'Sentiment Voices' (keyword tags) from breakdown data.

    PURPOSE: The frontend KeywordTag component needs a list of keywords with
    sentiment labels. When the database 'guest_mentions' column is empty
    (common for newly scanned hotels), this function generates keyword tags
    from the sentiment breakdown as a fallback.

    OUTPUT FORMAT (per item):
        {
            "keyword": "Service",      # English display name
            "raw_keyword": "Hizmet",   # Original Turkish name (for analytics)
            "count": 42,               # Number of mentions for the dominant sentiment
            "sentiment": "positive"    # "positive" | "negative" | "neutral"
        }

    Returns: Top 15 keywords sorted by total mentions (descending).
    """
    if not breakdown or not isinstance(breakdown, list):
        return []

    mentions = []
    # EXPLANATION: Sort by total_mentioned descending so the most-discussed
    # categories appear first in the UI keyword cloud.
    sorted_items = sorted(
        breakdown, key=lambda x: int(x.get("total_mentioned") or 0), reverse=True
    )

    for item in sorted_items:
        name = item.get("name")
        pos = int(item.get("positive") or 0)
        neg = int(item.get("negative") or 0)
        neu = int(item.get("neutral") or 0)
        total = int(item.get("total_mentioned") or 0)

        if total == 0:
            continue

        # EXPLANATION: Simple winner-takes-all sentiment classification.
        # The count returned is the winning sentiment's count, not total.
        sentiment = "neutral"
        if pos > neg and pos > neu:
            sentiment = "positive"
        elif neg > pos and neg > neu:
            sentiment = "negative"

        # EXPLANATION: Translate Turkish category names to English for display.
        display_keyword = name
        for tr_key, en_val in TR_MAP.items():
            if tr_key == name.lower() or tr_key in name.lower():
                display_keyword = en_val
                break

        mentions.append(
            {
                "keyword": display_keyword,
                "raw_keyword": name,  # Preserve original for backend analytics
                "count": pos
                if sentiment == "positive"
                else neg
                if sentiment == "negative"
                else total,
                "sentiment": sentiment,
            }
        )

    return mentions[:15]  # EXPLANATION: Cap at 15 to avoid UI clutter


def synthesize_value_score(ari: Optional[float]) -> Dict[str, Any]:
    """
    Generates a synthetic 'Value' sentiment score from Average Rate Index (ARI).

    PURPOSE: Google Reviews doesn't have a "Value" category score. Instead,
    we calculate perceived value from the hotel's price positioning vs market.

    FORMULA: score = 4.0 + (100 - ARI) / 25
        - ARI 100 (market average price) → Score 4.0 (neutral value)
        - ARI  80 (20% cheaper)          → Score 4.8 (great value)
        - ARI 120 (20% more expensive)   → Score 3.2 (poor value)
        - Clamped to [1.0, 5.0] range

    The output mimics the same structure as real sentiment breakdown items
    so it can be seamlessly inserted into the 4-pillar display.

    Args:
        ari: Average Rate Index (100 = market average). None if unavailable.

    Returns:
        Dict matching the sentiment breakdown item format, with "synthetic": True
        flag so the frontend can optionally style it differently.
    """
    # EXPLANATION: Return zeroed-out entry if ARI is missing or invalid.
    # The UI will show this pillar as "N/A" or "Insufficient Data".
    if ari is None or ari <= 0:
        return {
            "name": "Value",
            "positive": 0,
            "neutral": 0,
            "negative": 0,
            "total_mentioned": 0,
            "rating": 0,
        }

    # EXPLANATION: Linear formula mapping price-to-market ratio to a 1-5 score.
    # Cheaper than market = higher value score, more expensive = lower.
    score = max(1.0, min(5.0, 4.0 + (100 - ari) / 25))

    return {
        "name": "Value",
        "positive": 10,  # Fixed weight for visibility in the UI
        "neutral": 0,
        "negative": 0,
        "total_mentioned": 10,  # Non-zero so it doesn't get flagged as "estimated"
        "rating": round(score, 1),
        "synthetic": True,  # Flag: this score is computed, not from reviews
    }


def merge_sentiment_breakdowns(
    existing: List[Dict[str, Any]], new: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Cumulative Merge Strategy ("Smart Memory").

    PURPOSE: Traditional scrapers overwrite old sentiment data on each scan.
    This function ACCUMULATES data across multiple scans, preserving historical
    context. A hotel scanned 10 times will have richer, more accurate sentiment
    data than one scanned once.

    ALGORITHM:
        1. Normalize all category names to English using TR_MAP
           (e.g., "Uyku" and "Sleep" become the same entry)
        2. Sum numerical metrics (positive/negative/neutral/total) cumulatively
        3. Recalculate ratings using weighted average from accumulated counts
        4. Preserve descriptions from newer scans (fall back to old if new is empty)

    WHY CUMULATIVE:
        - Single scans may miss categories (google only returns top categories)
        - Reviews get added over time; older issues shouldn't disappear
        - Larger sample sizes produce more stable, reliable ratings

    Args:
        existing: Previously stored sentiment breakdown from database
        new: Fresh sentiment breakdown from latest scan

    Returns:
        Merged list sorted by total_mentioned (most discussed first)
    """
    # EXPLANATION: primary_map acts as the reconciliation registry.
    # Key = normalized English category name, Value = accumulated stats.
    primary_map: Dict[str, Dict[str, Any]] = {}

    # ── Phase 1: Load existing data into the map ──
    # EXPLANATION: We normalize existing category names to English first,
    # because previous scans might have stored them in Turkish.
    for item in existing:
        raw_name = item.get("name") or ""
        normalized_name = raw_name
        for tr, en in TR_MAP.items():
            if tr == raw_name.lower() or tr in raw_name.lower():
                normalized_name = en
                break

        if normalized_name not in primary_map:
            # EXPLANATION: Clone item data to avoid mutating the original list.
            primary_map[normalized_name] = {
                "name": normalized_name,
                "positive": int(item.get("positive") or 0),
                "negative": int(item.get("negative") or 0),
                "neutral": int(item.get("neutral") or 0),
                "total_mentioned": int(item.get("total_mentioned") or 0),
                "rating": float(item.get("rating") or 0),
            }
        else:
            # EXPLANATION: Handle duplicates within existing data itself.
            # This can happen from previous bad merges or data corruption.
            entry = primary_map[normalized_name]
            entry["positive"] += int(item.get("positive") or 0)
            entry["negative"] += int(item.get("negative") or 0)
            entry["neutral"] += int(item.get("neutral") or 0)
            entry["total_mentioned"] += int(item.get("total_mentioned") or 0)

    # ── Phase 2: Merge new scan data into the map ──
    # EXPLANATION: For each new category, either accumulate into existing
    # entry or create a new one if the category wasn't seen before.
    for item in new:
        raw_name = item.get("name") or ""
        normalized_name = raw_name
        for tr, en in TR_MAP.items():
            if tr == raw_name.lower() or tr in raw_name.lower():
                normalized_name = en
                break

        if normalized_name in primary_map:
            # EXPLANATION: Category exists — accumulate counts cumulatively.
            entry = primary_map[normalized_name]
            entry["positive"] += int(item.get("positive") or 0)
            entry["negative"] += int(item.get("negative") or 0)
            entry["neutral"] += int(item.get("neutral") or 0)
            entry["total_mentioned"] += int(item.get("total_mentioned") or 0)

            # EXPLANATION: Smart Content Merge — prefer newer descriptions
            # since they reflect the latest scan's AI-generated summaries.
            # Only overwrite if the new scan actually provides one.
            if item.get("description"):
                entry["description"] = item["description"]
            if item.get("summary"):
                entry["summary"] = item["summary"]

            # EXPLANATION: Recalculate rating from accumulated counts.
            # This is more accurate than averaging old and new ratings
            # because it weights by actual mention volume.
            new_rating = float(item.get("rating") or 0)
            if entry["total_mentioned"] > 0 and new_rating > 0:
                entry["rating"] = (
                    entry["positive"] * 5 + entry["neutral"] * 3 + entry["negative"] * 1
                ) / entry["total_mentioned"]
        else:
            # EXPLANATION: Brand new category not seen in existing data.
            # Insert it directly into the map.
            primary_map[normalized_name] = {
                "name": normalized_name,
                "positive": int(item.get("positive") or 0),
                "negative": int(item.get("negative") or 0),
                "neutral": int(item.get("neutral") or 0),
                "total_mentioned": int(item.get("total_mentioned") or 0),
                "rating": float(item.get("rating") or 0),
                "description": item.get("description"),
                "summary": item.get("summary"),
            }

    # ── Phase 3: Finalize and sort ──
    # EXPLANATION: Round ratings to 1 decimal place for clean UI display.
    # Sort by total_mentioned descending so the most-discussed categories
    # appear first in the UI breakdown view.
    merged_list = list(primary_map.values())
    for item in merged_list:
        item["rating"] = round(item["rating"], 1)

    return sorted(merged_list, key=lambda x: x["total_mentioned"], reverse=True)
