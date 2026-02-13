import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from backend.services.analysis_service import _normalize_sentiment, _generate_mentions

# Mock data from Ramada Residences
ramada_breakdown = [
  {
    "name": "Dining",
    "description": "Food and Beverage",
    "positive": 16,
    "total_mentioned": 29
  },
  {
    "name": "Bar",
    "description": "Bar or lounge",
    "positive": 7,
    "total_mentioned": 13
  },
  {
    "name": "Hizmet",
    "description": "Service",
    "positive": 74,
    "negative": 20,
    "neutral": 6,
    "total_mentioned": 100
  }
]

def test_normalization():
    print("--- TESTING RAMADA ---")
    norm_ramada = _normalize_sentiment(ramada_breakdown)
    pillars = [n["name"] for n in norm_ramada if n.get("is_inferred")]
    print(f"Original categories: {[n['name'] for n in ramada_breakdown]}")
    print(f"Inferred pillars: {pillars}")
    
    print("\n--- TESTING MENTIONS (VOICES) ---")
    mentions = _generate_mentions(ramada_breakdown)
    print(f"Synthesized Mentions: {mentions[:3]}")
    
    # Check for Hizmet mapping
    hizmet = next((m for m in mentions if m["keyword"] == "Hizmet"), None)
    if hizmet:
        print(f"SUCCESS: Found Hizmet Voice: {hizmet}")

if __name__ == "__main__":
    test_normalization()
