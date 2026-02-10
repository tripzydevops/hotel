import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

load_dotenv()
load_dotenv(".env.local", override=True)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_reviews_breakdown(breakdown, overall_rating):
    """Ensures the 4 core pillars (Cleanliness, Service, Location, Value) exist."""
    valid = breakdown or []
    
    # Standardize keys
    standard_map = {
        "cleanliness": "Cleanliness", "clean": "Cleanliness", "room": "Cleanliness",
        "service": "Service", "staff": "Service", 
        "location": "Location", "neighborhood": "Location",
        "value": "Value", "price": "Value", "comfort": "Value"
    }
    
    # Create a dictionary of existing scores
    existing = {}
    for item in valid:
        name = item.get("name", "").lower()
        if name in standard_map:
            existing[standard_map[name]] = item.get("rating") or item.get("total_score")
        else:
            existing[name.title()] = item.get("rating")
            
    # Fill missing core categories with overall rating (fallback) or 0
    core_categories = ["Cleanliness", "Service", "Location", "Value"]
    final_breakdown = []
    
    for cat in core_categories:
        if cat in existing:
            final_breakdown.append({"name": cat, "rating": existing[cat], "sentiment": "neutral"})
        else:
            # Fallback: If we have an overall rating, use it (minus penalty to be conservative), else 0
            fallback = (float(overall_rating) - 0.5) if overall_rating else 0
            final_breakdown.append({"name": cat, "rating": max(0, fallback), "sentiment": "neutral", "is_inferred": True})
    
    # Add any other non-core categories found
    for item in valid:
        name = item.get("name", "").title()
        if name not in core_categories and name not in ["Total"]:
            final_breakdown.append(item)
            
    return final_breakdown

def main():
    print("Starting Sentiment Backfill...")
    
    # Fetch all hotels
    response = supabase.table("hotels").select("id, name, sentiment_breakdown, rating").execute()
    hotels = response.data
    
    if not hotels:
        print("No hotels found.")
        return

    print(f"Found {len(hotels)} hotels.")
    
    updated_count = 0
    for hotel in hotels:
        print(f"Processing: {hotel.get('name')}...")
        
        current_breakdown = hotel.get("sentiment_breakdown") or []
        overall_rating = hotel.get("rating")
        
        new_breakdown = normalize_reviews_breakdown(current_breakdown, overall_rating)
        
        # Check if actually changed (simple length check or deep comparison)
        # For now, just update all to be safe and consistent
        
        supabase.table("hotels").update({
            "sentiment_breakdown": new_breakdown
        }).eq("id", hotel["id"]).execute()
        
        updated_count += 1
        print(f"  -> Updated {hotel.get('name')}")

    print(f"Backfill Complete. Updated {updated_count} hotels.")

if __name__ == "__main__":
    main()
