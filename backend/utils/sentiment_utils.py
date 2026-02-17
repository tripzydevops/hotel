from typing import List, Dict, Any, Optional

TR_MAP = {
    "hizmet": "Service",
    "temizlik": "Cleanliness",
    "konum": "Location",
    "oda": "Room",
    "kahvaltı": "Breakfast",
    "fiyat": "Price",
    "değer": "Value",
    "personel": "Staff",
    "mülk": "Property",
    "uyku": "Sleep",
    "banyo": "Bathroom",
    "konfor": "Comfort",
    "yemek": "Food",
    "havuz": "Pool",
    "restoran": "Restaurant",
    "atmosfer": "Atmosphere",
    "kablosuz": "Wi-Fi",
    "klima": "A/C",
    "aile": "Family",
    "çiftler": "Couples",
    "iş": "Business",
    "fitness": "Fitness",
    "sağlıklı yaşam": "Wellness",
    "gece hayatı": "Nightlife",
    "otopark": "Parking",
    "bar": "Bar",
    "erişilebilirlik": "Accessibility",
    "mutfak": "Kitchen",
    "sessizlik": "Quietness",
    "yatak": "Bed",
    "resepsiyon": "Reception",
    "manzara": "View",
    "ulaşım": "Transport",
    "internet": "Internet",
    "güvenlik": "Security",
    "dining": "Dining",
}

def normalize_sentiment(breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Standardizes diverse sentiment categories from Google Reviews into four core pillars.
    
    Why: Google Reviews returns locale-specific names (e.g., 'Uyku', 'Hizmet', 'Dining').
    The UI expects exactly: Cleanliness, Service, Location, Value.
    """
    if not breakdown or not isinstance(breakdown, list):
        return []

    # Target Pillars
    pillars = {
        "Cleanliness": {"positive": 0, "negative": 0, "neutral": 0, "total": 0},
        "Service": {"positive": 0, "negative": 0, "neutral": 0, "total": 0},
        "Location": {"positive": 0, "negative": 0, "neutral": 0, "total": 0},
        "Value": {"positive": 0, "negative": 0, "neutral": 0, "total": 0}
    }

    # Keyword Mapping (Expanded Turkish set)
    # Using substring matching for flexibility
    mappings = {
        "Cleanliness": ["temizlik", "cleanliness", "oda", "room", "banyo", "bathroom", "hijyen", "hygiene", "housekeeping", "uyku", "sleep", "yatak", "bed", "mülk", "property", "tesis", "facility", "konfor", "comfort", "klima", "air conditioning", "internet", "wifi", "kablosuz"],
        "Service": ["hizmet", "service", "personel", "staff", "ilgi", "reception", "resepsiyon", "kahvaltı", "breakfast", "karşılama", "welcoming", "dining", "yemek", "restoran", "restaurant", "food", "yiyecek", "içecek", "bar", "atmosfer", "atmosphere", "sağlıklı yaşam", "spa", "wellness", "pool", "havuz", "fitness", "sauna"],
        "Location": ["konum", "location", "yer", "place", "manzara", "view", "ulaşım", "access", "çevre", "neighborhood", "merkez", "gece hayatı", "nightlife", "otopark", "parking", "transport", "trafik", "traffic"],
        "Value": ["fiyat", "price", "değer", "value", "fiyat-performans", "cost", "ucuzluk", "maliyet", "ekonomik", "pahalı", "para", "money", "affordable", "ucuz", "pahalı", "kalite", "quality", "fırsat", "teklif", "deal", "offer"]
    }

    found_pillars = set()

    for item in breakdown:
        name = item.get("name", "").lower()
        pos = int(item.get("positive") or 0)
        neg = int(item.get("negative") or 0)
        neu = int(item.get("neutral") or 0)
        total = int(item.get("total_mentioned") or 0)

        mapped = False
        for pillar, keywords in mappings.items():
            if any(kw in name for kw in keywords):
                pillars[pillar]["positive"] += pos
                pillars[pillar]["negative"] += neg
                pillars[pillar]["neutral"] += neu
                pillars[pillar]["total"] += total
                found_pillars.add(pillar)
                mapped = True
                break
    
    # Format for UI - Always return all 4 pillars
    result = []
    # Force order: Cleanliness, Service, Location, Value
    for name in ["Cleanliness", "Service", "Location", "Value"]:
        stats = pillars[name]
        result.append({
            "name": name,
            "positive": stats["positive"],
            "negative": stats["negative"],
            "neutral": stats["neutral"],
            "total_mentioned": stats["total"]
        })
    
    return result

def translate_breakdown(breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Translates raw Turkish SerpApi categories to English for UI consistency,
    but keeps the internal variety (unlike normalize_sentiment).
    """
    if not breakdown or not isinstance(breakdown, list):
        return []

    translated = []
    for item in breakdown:
        name = item.get("name", "")
        # Try exact or substring
        label = name
        for tr_key, en_val in TR_MAP.items():
            if tr_key == name.lower() or tr_key in name.lower():
                label = en_val
                break
        
        translated.append({
            **item,
            "display_name": label
        })
    return translated

def generate_mentions(breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Synthesizes 'Sentiment Voices' (keyword tags) from breakdown data.
    
    Used as a fallback when the structured 'guest_mentions' column is empty.
    """
    if not breakdown or not isinstance(breakdown, list):
        return []

    mentions = []
    # Sort by visibility/volume
    sorted_items = sorted(breakdown, key=lambda x: int(x.get("total_mentioned") or 0), reverse=True)
    
    for item in sorted_items:
        name = item.get("name")
        pos = int(item.get("positive") or 0)
        neg = int(item.get("negative") or 0)
        neu = int(item.get("neutral") or 0)
        total = int(item.get("total_mentioned") or 0)
        
        if total == 0: continue
        
        # Simple sentiment winner logic
        sentiment = "neutral"
        if pos > neg and pos > neu:
            sentiment = "positive"
        elif neg > pos and neg > neu:
            sentiment = "negative"
            
        # KAİZEN: Localized Keywords for 'Voices'
        display_keyword = name
        for tr_key, en_val in TR_MAP.items():
            if tr_key == name.lower() or tr_key in name.lower():
                display_keyword = en_val
                break

        mentions.append({
            "keyword": display_keyword,
            "raw_keyword": name, # Keep original for analytics if needed
            "count": pos if sentiment == "positive" else neg if sentiment == "negative" else total,
            "sentiment": sentiment
        })
        
    return mentions[:15] # Top 15 for UI density

def synthesize_value_score(ari: Optional[float]) -> Dict[str, Any]:
    """
    Generates a synthetic 'Value' sentiment breakdown based on Average Rate Index.
    
    ARI 100 = Market average price (Score 4.0)
    ARI 80 = 20% cheaper than market (Score 4.8)
    ARI 120 = 20% more expensive (Score 3.2)
    """
    if ari is None or ari <= 0:
        return {
            "name": "Value",
            "positive": 0,
            "neutral": 0,
            "negative": 0,
            "total_mentioned": 0,
            "rating": 0
        }
        
    # Formula: 4.0 + (100 - ARI) / 25
    # e.g. ARI 80 -> 4.0 + 20/25 = 4.8
    # e.g. ARI 120 -> 4.0 - 20/25 = 3.2
    score = max(1.0, min(5.0, 4.0 + (100 - ari) / 25))
    
    return {
        "name": "Value",
        "positive": 10, # Weighted for visibility
        "neutral": 0,
        "negative": 0,
        "total_mentioned": 10,
        "rating": round(score, 1),
        "synthetic": True
    }
