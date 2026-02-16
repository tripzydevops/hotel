from typing import List, Dict, Any

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
        "Cleanliness": ["temizlik", "cleanliness", "oda", "room", "banyo", "bathroom", "hijyen", "hygiene", "housekeeping", "uyku", "sleep", "yatak", "bed", "mülk", "property", "tesis", "facility", "konfor", "comfort", "klima", "air conditioning"],
        "Service": ["hizmet", "service", "personel", "staff", "ilgi", "reception", "resepsiyon", "kahvaltı", "breakfast", "karşılama", "welcoming", "dining", "yemek", "restoran", "restaurant", "food", "yiyecek", "içecek", "bar", "atmosfer", "atmosphere", "kablosuz", "wifi", "internet", "sağlıklı yaşam", "spa", "wellness", "pool", "havuz"],
        "Location": ["konum", "location", "yer", "place", "manzara", "view", "ulaşım", "access", "çevre", "neighborhood", "merkez", "gece hayatı", "nightlife", "otopark", "parking", "transport"],
        "Value": ["fiyat", "price", "değer", "value", "fiyat-performans", "cost", "ucuzluk", "maliyet", "ekonomik", "pahalı", "para", "money", "affordable", "ucuz", "pahalı", "kalite", "quality"]
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
            
        mentions.append({
            "keyword": name,
            "count": pos if sentiment == "positive" else neg if sentiment == "negative" else total,
            "sentiment": sentiment
        })
        
    return mentions[:15] # Top 15 for UI density
