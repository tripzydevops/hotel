import os
import json
from supabase import create_client
from backend.utils.sentiment_utils import normalize_sentiment

# Setup Supabase
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

def debug_sentiment():
    print("Searching for Ramada...")
    res = supabase.table("hotels").select("id, name, sentiment_breakdown").ilike("name", "%RAMADA%").execute()
    hotels = res.data or []
    
    if not hotels:
        print("No Ramada hotel found.")
        return

    target_hotel = hotels[0]
    print(f"Found hotel: {target_hotel['name']}")
    
    raw_breakdown = target_hotel.get("sentiment_breakdown")
    print(f"\nRaw Breakdown: {json.dumps(raw_breakdown, indent=2)}")
    
    normalized = normalize_sentiment(raw_breakdown)
    print(f"\nNormalized Breakdown: {json.dumps(normalized, indent=2)}")
    
    value_pillar = next((item for item in normalized if item["name"] == "Value"), None)
    if not value_pillar:
        print("\nFAIL: 'Value' pillar is missing from normalized results.")
    else:
        print(f"\nPASS: 'Value' pillar found: {value_pillar}")

if __name__ == "__main__":
    debug_sentiment()
