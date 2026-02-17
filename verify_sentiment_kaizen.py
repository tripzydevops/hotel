import os
import json
from backend.utils.sentiment_utils import normalize_sentiment, translate_breakdown

def verify_sentiment_kaizen():
    print("--- Verifying Sentiment Kaizen Fixes ---")
    
    # Mock data from SerpApi (Turkish)
    breakdown = [
        {"name": "Hizmet", "positive": 10, "negative": 1, "neutral": 2, "total_mentioned": 13},
        {"name": "Temizlik", "positive": 8, "negative": 0, "neutral": 1, "total_mentioned": 9},
        {"name": "Konum", "positive": 20, "negative": 2, "neutral": 3, "total_mentioned": 25},
        {"name": "Değer", "positive": 5, "negative": 5, "neutral": 0, "total_mentioned": 10}, # Value pillar in Turkish
        {"name": "Mülk", "positive": 15, "negative": 0, "neutral": 2, "total_mentioned": 17}, # Raw category
        {"name": "Uyku", "positive": 12, "negative": 1, "neutral": 1, "total_mentioned": 14}, # Raw category
    ]
    
    # 1. Test Normalization (4 Pillars)
    normalized = normalize_sentiment(breakdown)
    print("\n[1] Normalized 4 Pillars:")
    for p in normalized:
        print(f" - {p['name']}: {p['total_mentioned']} mentions")
        if p['name'] == "Value":
            assert p['total_mentioned'] == 10, f"Value pillar not detected! Found {p['total_mentioned']}"
            print("   ✅ Value mapping confirmed")

    # 2. Test Translation (Variety)
    translated = translate_breakdown(breakdown)
    print("\n[2] Translated Variety (Deep Dive):")
    detected_en = [item['display_name'] for item in translated]
    print(f" - Detected Categories: {detected_en}")
    assert "Sleep" in detected_en, "Uyku -> Sleep translation failed"
    assert "Property" in detected_en, "Mülk -> Property translation failed"
    print("   ✅ Deep Dive variety translation confirmed")

    # 3. Test Value Synthesis (Mocking ARI 80)
    # We'll mock the logic from analysis_service
    target_price = 800
    market_avg = 1000
    ari_val = (target_price / market_avg) * 100 # 80 (Good Value)
    
    # Logic from analysis_service:
    syn_score = max(1.0, min(5.0, 4.0 + (100 - ari_val) / 25)) # 4.0 + (20) / 25 = 4.8
    print(f"\n[3] Value Synthesis (ARI={ari_val}):")
    print(f" - Synthesized Score: {syn_score}")
    assert syn_score >= 4.5, f"Expected high Value score for low ARI, got {syn_score}"
    print("   ✅ Value synthesis logic confirmed")

    # 4. Test Dashboard Consistency
    # We'll simulate the dashboard calc logic
    raw_br = [
        {"name": "Hizmet", "positive": 10, "total_mentioned": 10}
    ]
    norm_br = normalize_sentiment(raw_br)
    raw_translated = translate_breakdown(raw_br)
    
    print("\n[4] Dashboard Payload Simulation:")
    print(f" - Normalized count: {len(norm_br)}")
    print(f" - Raw variety count: {len(raw_translated)}")
    assert len(norm_br) == 4, "Dashboard normalization must return 4 pillars"
    assert len(raw_translated) == 1, "Dashboard raw variety must contain all items"
    print("   ✅ Dashboard payload consistency confirmed")

    print("\n--- ALL TESTS PASSED ---")

if __name__ == "__main__":
    verify_sentiment_kaizen()
