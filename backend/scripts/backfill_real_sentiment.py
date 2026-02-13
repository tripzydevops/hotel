# ruff: noqa
import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv # type: ignore

# Add root to path
sys.path.append(os.getcwd())
load_dotenv(os.path.join(os.getcwd(), '.env.local'))
load_dotenv(os.path.join(os.getcwd(), '.env'))

from backend.main import get_supabase # type: ignore

async def backfill_real_sentiment():
    db = get_supabase()
    if not db:
        print("Error: Could not connect to Supabase.")
        return

    print("--- Backfilling Real Sentiment Data from History ---")
    
    try:
        # 1. Fetch all sentiment history
        res_hist = db.table("sentiment_history")\
            .select("hotel_id, rating, review_count, sentiment_breakdown, recorded_at")\
            .order("recorded_at", desc=True)\
            .execute()
        
        history = res_hist.data or []
        print(f"Found {len(history)} total history entries.")

        # 2. Get the latest non-empty breakdown for each hotel_id
        latest_data = {}
        for entry in history:
            hotel_id = entry['hotel_id']
            breakdown = entry.get('sentiment_breakdown')
            
            if hotel_id not in latest_data and breakdown and len(breakdown) > 0:
                latest_data[hotel_id] = {
                    "rating": entry.get('rating'),
                    "review_count": entry.get('review_count'),
                    "sentiment_breakdown": breakdown
                }

        print(f"Hotels with usable historical sentiment: {len(latest_data)}")

        # 3. Update hotels table
        updated_count = 0
        for hotel_id, data in latest_data.items():
            print(f"Updating hotel {hotel_id}...")
            try:
                # We update current_price related fields if we can, but primarily we want sentiment
                update_payload = {
                    "sentiment_breakdown": data["sentiment_breakdown"]
                }
                if data["rating"]:
                    update_payload["rating"] = data["rating"]
                if data["review_count"]:
                    update_payload["review_count"] = data["review_count"]
                
                db.table("hotels").update(update_payload).eq("id", hotel_id).execute()
                current_count: int = updated_count
                updated_count = current_count + 1
            except Exception as e:
                print(f"  Error updating hotel {hotel_id}: {e}")

        print(f"Successfully backfilled {updated_count} hotels.")
        print("--- Backfill Complete ---")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(backfill_real_sentiment())
