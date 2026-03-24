
import asyncio
import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client
from typing import Dict, Any, List

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.utils.embeddings import get_embedding

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("[Error] Supabase credentials not found.")
    sys.exit(1)

supabase = create_client(url, key)

def format_sentiment_profile(hotel: Dict[str, Any]) -> str:
    """
    Constructs a text representation of the hotel's sentiment profile.
    """
    name = hotel.get("name", "Unknown Hotel")
    stars = hotel.get("stars", "?")
    location = hotel.get("location", "Unknown Location")
    
    breakdown = hotel.get("sentiment_breakdown") or {}
    reviews = hotel.get("reviews") or []
    
    # Format Breakdown
    # e.g. "Cleanliness: 4.5, Service: 4.0"
    stats_text = ""
    if isinstance(breakdown, dict):
        parts: List[str] = []
        for k, v in breakdown.items():
            if isinstance(v, (int, float)):
                 parts.append(f"{k}: {v}")
            elif isinstance(v, dict) and "score" in v:
                 parts.append(f"{k}: {v['score']}")
        stats_text = ", ".join(parts)
        
    # Format Reviews (Top 3)
    reviews_text = ""
    if isinstance(reviews, list):
        # Explicit check/cast for list
        review_list: List[Any] = reviews
        snippets: List[str] = []
        # Slice safely
        top_reviews = review_list[:3]
        for r in top_reviews:
            if isinstance(r, dict):
                text = r.get("title") or r.get("snippet") or r.get("text")
                if isinstance(text, str):
                    snippets.append(f"\"{text}\"")
            elif isinstance(r, str):
                snippets.append(f"\"{r}\"")
        reviews_text = " ".join(snippets)

    profile = f"""
Hotel: {name}
Stars: {stars}
Location: {location}
Sentiment Stats: {stats_text}
Top Reviews: {reviews_text}
    """.strip()
    
    return profile

async def update_sentiment_embeddings(dry_run: bool = False):
    print(f"\n[Sentiment Embedding] Starting backfill...")
    
    # 1. Fetch hotels with sentiment data
    # We want hotels that HAVE breakdown or reviews
    res = supabase.table("hotels").select("*").execute()
    hotels = res.data or []
    
    print(f"[Sentiment Embedding] Found {len(hotels)} hotels to check.")
    
    count = 0
    
    for hotel in hotels:
        # Check if we have enough data to embed
        breakdown = hotel.get("sentiment_breakdown")
        reviews = hotel.get("reviews")
        
        has_data = (breakdown and breakdown != {}) or (reviews and len(reviews) > 0)
        
        if not has_data:
            print(f"  [Skip] {hotel['name']} - No sentiment data.")
            continue
            
        # Check if already embedded? (Optional, skipping for now to allow updates)
        
        text_profile = format_sentiment_profile(hotel)
        
        if dry_run:
            print(f"  [Dry Run] Would embed for {hotel['name']}:\n  ---\n{text_profile}\n  ---")
            count += 1
            continue
            
        try:
            print(f"  [Embed] Generating for {hotel['name']}...")
            # Use output_dimensionality=768 to match column
            # Note: utils.embeddings.get_embedding should already handle 768 via 'output_dimensionality' param if passed
            # But the utility function signature might need checking. 
            # Phase 1 fixed get_embedding to use 768 by default or param?
            # Let's assume get_embedding returns a list of floats.
            
            embedding = await get_embedding(text_profile)
            
            if len(embedding) != 768:
                 print(f"    [Error] Embedding dimension mismatch: got {len(embedding)}, expected 768")
                 # Try truncating or re-requesting? Phase 1 fixed this in utils.
                 continue

            # Update DB
            supabase.table("hotels").update({"sentiment_embedding": embedding}).eq("id", hotel["id"]).execute()
            print(f"    [Success] Updated.")
            count += 1
            
        except Exception as e:
            print(f"    [Error] Failed: {e}")

    print(f"\n[Sentiment Embedding] Finished. Processed {count} hotels.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    
    asyncio.run(update_sentiment_embeddings(dry_run=args.dry_run))
