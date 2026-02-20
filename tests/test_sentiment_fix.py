from backend.utils.sentiment_utils import merge_sentiment_breakdowns, normalize_sentiment

def test_merge_preserves_description():
    existing = [
        {
            "name": "Service",
            "positive": 5,
            "negative": 1,
            "neutral": 0,
            "total_mentioned": 6,
            "rating": 4.5,
            "description": "Old service description"
        }
    ]
    
    new = [
        {
            "name": "Service",
            "positive": 2,
            "negative": 0,
            "neutral": 1,
            "total_mentioned": 3,
            "rating": 4.8,
            "description": "New service description",
            "summary": "Great service summary"
        },
        {
            "name": "Cleanliness",
            "positive": 10,
            "negative": 0,
            "neutral": 0,
            "total_mentioned": 10,
            "rating": 5.0,
            "description": "Sparkling clean"
        }
    ]
    
    merged = merge_sentiment_breakdowns(existing, new)
    
    # Check Service
    service = next(item for item in merged if item["name"] == "Service")
    assert service["total_mentioned"] == 9
    assert service["description"] == "New service description"
    assert service["summary"] == "Great service summary"
    
    # Check Cleanliness
    clean = next(item for item in merged if item["name"] == "Cleanliness")
    assert clean["description"] == "Sparkling clean"
    
    print("Merge test passed!")

def test_normalize_preserves_description():
    raw = [
        {
            "name": "Hizmet",
            "positive": 10,
            "negative": 0,
            "neutral": 0,
            "total_mentioned": 10,
            "description": "Hizmet harika"
        },
        {
            "name": "Temizlik",
            "positive": 5,
            "negative": 0,
            "neutral": 0,
            "total_mentioned": 5,
            "description": "Oda temizdi"
        }
    ]
    
    normalized = normalize_sentiment(raw)
    
    service = next(item for item in normalized if item["name"] == "Service")
    assert service["description"] == "Hizmet harika"
    
    clean = next(item for item in normalized if item["name"] == "Cleanliness")
    assert clean["description"] == "Oda temizdi"
    
    print("Normalization test passed!")

if __name__ == "__main__":
    test_merge_preserves_description()
    test_normalize_preserves_description()
