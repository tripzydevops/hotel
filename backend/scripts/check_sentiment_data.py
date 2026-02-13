# ruff: noqa
import asyncio
import os
import sys
from dotenv import load_dotenv # type: ignore
import google.generativeai as genai # type: ignore (Suppressing warning)

# Add root to path
sys.path.append(os.getcwd())
load_dotenv(os.path.join(os.getcwd(), '.env.local'))
load_dotenv(os.path.join(os.getcwd(), '.env'))

from backend.main import get_supabase # type: ignore

async def check_sentiment_data():
    db = get_supabase()
    if not db:
        print("Error: Could not connect to Supabase.")
        return

    print("--- Checking Sentiment History ---")
    try:
        # Fetch actual entries to see if breakdown is populated
        res = db.table("sentiment_history").select("hotel_id, rating, sentiment_breakdown").execute()
        history = res.data or []
        print(f"Total entries in sentiment_history: {len(history)}")
        
        rich_history = [e for e in history if e.get('sentiment_breakdown') and len(e['sentiment_breakdown']) > 0]
        print(f"Entries with non-empty sentiment_breakdown: {len(rich_history)}")
        
        # Safe slicing
        for i in range(min(3, len(rich_history))):
            e = rich_history[i]
            breakdown = e.get('sentiment_breakdown') or []
            print(f"  - Hotel: {e['hotel_id']} | Rating: {e['rating']} | Breakdown items: {len(breakdown)}")
    except Exception as e:
        print(f"Error checking sentiment_history: {e}")

    print("\n--- Checking Hotels with Sentiment Breakdown ---")
    try:
        res = db.table("hotels").select("id, name, sentiment_breakdown").not_.is_("sentiment_breakdown", "null").execute()
        hotels_with_data = res.data or []
        print(f"Hotels with non-null sentiment_breakdown: {len(hotels_with_data)}")
        
        for i in range(min(3, len(hotels_with_data))):
            h = hotels_with_data[i]
            breakdown = h.get('sentiment_breakdown') or []
            # Safe sampling
            sample = breakdown[0] if len(breakdown) > 0 else "Empty"
            print(f"  - {h['name']}: {sample}")
            
        res_zero = db.table("hotels").select("id, name").is_("sentiment_breakdown", "null").execute()
        print(f"Hotels with NULL sentiment_breakdown: {len(res_zero.data) if res_zero.data else 0}")
    except Exception as e:
        print(f"Error checking hotels: {e}")

if __name__ == "__main__":
    asyncio.run(check_sentiment_data())
