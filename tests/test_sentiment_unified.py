import sys
import os
from datetime import datetime

# Ensure backend can be imported
sys.path.append(os.getcwd())

from backend.utils.sentiment_utils import normalize_sentiment, generate_mentions

def test_normalization():
    print("Testing Sentiment Normalization...")
    raw_data = [
        {"name": "Uyku Kalitesi", "positive": 10, "negative": 2, "neutral": 1, "total_mentioned": 13},
        {"name": "Hizmet ve Personel", "positive": 20, "negative": 1, "neutral": 2, "total_mentioned": 23},
        {"name": "Merkezi Konum", "positive": 15, "negative": 0, "neutral": 0, "total_mentioned": 15},
        {"name": "Fiyat Performans", "positive": 5, "negative": 5, "neutral": 2, "total_mentioned": 12},
        {"name": "Unknown Category", "positive": 1, "negative": 1, "neutral": 0, "total_mentioned": 2}
    ]
    
    normalized = normalize_sentiment(raw_data)
    print(f"Normalized: {normalized}")
    
    # Check if Cleanliness was mapped from Uyku
    cleanliness = next((p for p in normalized if p["name"] == "Cleanliness"), None)
    assert cleanliness is not None, "Cleanliness pillar missing"
    assert cleanliness["positive"] == 10
    
    # Check if Service was mapped
    service = next((p for p in normalized if p["name"] == "Service"), None)
    assert service is not None, "Service pillar missing"
    
    print("✅ Normalization items verified.")

def test_mentions():
    print("Testing Mention Synthesis...")
    raw_data = [
        {"name": "Kahvaltı", "positive": 10, "negative": 2, "neutral": 1, "total_mentioned": 13},
        {"name": "Gürültü", "positive": 1, "negative": 9, "neutral": 1, "total_mentioned": 11}
    ]
    
    mentions = generate_mentions(raw_data)
    print(f"Mentions: {mentions}")
    
    assert len(mentions) == 2
    assert mentions[0]["keyword"] == "Kahvaltı"
    assert mentions[0]["sentiment"] == "positive"
    assert mentions[1]["keyword"] == "Gürültü"
    assert mentions[1]["sentiment"] == "negative"
    
    print("✅ Mention synthesis verified.")

if __name__ == "__main__":
    try:
        test_normalization()
        test_mentions()
        print("\n🎉 ALL TESTS PASSED!")
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
