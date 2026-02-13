
import asyncio
import os
import random
from dotenv import load_dotenv # type: ignore
from supabase import create_client, Client # type: ignore

# Force reload
load_dotenv(".env.local")
load_dotenv(".env")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found.")
    exit(1)

supabase: Client = create_client(url, key)

async def backfill_sentiment():
    print("--- Backfilling Sentiment Data ---")
    
    try:
        # 1. Fetch all hotels
        res = supabase.table("hotels").select("*").execute()
        hotels = res.data or []
        
        print(f"Found {len(hotels)} hotels to update.")
        
        for hotel in hotels:
            hotel_id = hotel['id']
            name = hotel['name']
            
            # 2. Generate Dummy Sentiment Data (Realistic)
            # Base rating
            base_rating = hotel.get('rating') or random.uniform(3.5, 4.8)
            
            # Sentiment Breakdown
            sentiment_breakdown = [
                {"category": "Cleanliness", "name": "Cleanliness", "rating": round(float(min(5.0, base_rating + random.uniform(-0.5, 0.5))), 1), "sentiment": "positive"}, # type: ignore
                {"category": "Service", "name": "Service", "rating": round(float(min(5.0, base_rating + random.uniform(-0.8, 0.4))), 1), "sentiment": "positive"}, # type: ignore
                {"category": "Location", "name": "Location", "rating": round(float(min(5.0, base_rating + random.uniform(-0.2, 0.6))), 1), "sentiment": "positive"}, # type: ignore
                {"category": "Value", "name": "Value", "rating": round(float(min(5.0, base_rating + random.uniform(-0.6, 0.2))), 1), "sentiment": "neutral"}, # type: ignore
                 {"category": "Comfort", "name": "Comfort", "rating": round(float(min(5.0, base_rating + random.uniform(-0.4, 0.4))), 1), "sentiment": "positive"} # type: ignore
            ]
            
            # Guest Mentions
            positive_adjectives = ["Great", "Excellent", "Amazing", "Wonderful", "Good", "Lovely"]
            negative_adjectives = ["Noisy", "Small", "Dirty", "Old", "Expensive", "Crowded"]
            features = ["Breakfast", "Pool", "Location", "Staff", "Room", "View", "Bed", "Wifi"]
            
            guest_mentions = []
            # Add 3-5 positive
            for _ in range(random.randint(3, 5)):
                adj = random.choice(positive_adjectives)
                feat = random.choice(features)
                guest_mentions.append({"keyword": f"{adj} {feat}", "sentiment": "positive", "count": random.randint(5, 50)})
                
            # Add 1-2 negative
            for _ in range(random.randint(1, 2)):
                adj = random.choice(negative_adjectives)
                feat = random.choice(features)
                guest_mentions.append({"keyword": f"{adj} {feat}", "sentiment": "negative", "count": random.randint(2, 15)})
            
            # 3. Update Hotel
            update_data = {
                "sentiment_breakdown": sentiment_breakdown,
                "guest_mentions": guest_mentions
            }
            
            print(f"Updating {name} ({hotel_id})...")
            update_res = supabase.table("hotels").update(update_data).eq("id", hotel_id).execute()
            
            if not update_res.data:
                print(f"Failed to update {name}")

        print("--- Backfill Complete ---")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(backfill_sentiment())
