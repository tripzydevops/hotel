
import asyncio
import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("[Error] Supabase credentials not found.")
    sys.exit(1)

supabase = create_client(url, key)

def test_match():
    print("Fetching a hotel with sentiment embedding...")
    
    # 1. Get a source hotel
    res = supabase.table("hotels").select("*").not_.is_("sentiment_embedding", "null").limit(1).execute()
    if not res.data:
        print("[Error] No hotels with sentiment embedding found.")
        return

    source = res.data[0]
    print(f"Source Hotel: {source['name']} ({source['location']})")
    print(f"Sentiment Breakdown: {source.get('sentiment_breakdown')}")
    
    embedding = source["sentiment_embedding"]
    
    # 2. Find similar hotels
    print("\nFinding similar hotels by vibe...")
    
    try:
        matches = supabase.rpc("match_hotels_by_sentiment", {
            "query_embedding": embedding,
            "match_threshold": 0.5, # Low threshold for testing with few hotels
            "match_count": 5,
            "source_hotel_id": source["id"]
        }).execute()
        
        if not matches.data:
            print("No matches found (might need more data).")
        else:
            print(f"Found {len(matches.data)} matches:")
            for m in matches.data:
                print(f" - {m['name']} (Sim: {m['similarity']:.4f})")
                print(f"   Breakdown: {m['sentiment_breakdown']}")
                
    except Exception as e:
        print(f"[Error] RPC Call failed: {e}")

if __name__ == "__main__":
    test_match()
