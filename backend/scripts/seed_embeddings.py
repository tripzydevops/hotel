import asyncio
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Context setup
sys.path.append(os.path.join(os.getcwd(), "backend"))
load_dotenv()
load_dotenv(".env.local", override=True)

from backend.utils.embeddings import get_embedding, format_hotel_for_embedding

async def seed_embeddings():
    print("[Seed] Starting embedding backfill...")
    
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("[Seed] Error: Missing Supabase credentials")
        return

    db = create_client(url, key)
    
    # 1. Fetch hotels without embeddings
    # Note: We'll fetch all and filter or update all for now
    res = db.table("hotel_directory").select("*").execute()
    hotels = res.data or []
    
    print(f"[Seed] Found {len(hotels)} hotels to process.")
    
    for hotel in hotels:
        name = hotel.get("name")
        hotel_id = hotel.get("id")
        
        if hotel.get("embedding"):
            print(f"  -> Skipping {name} (already embedded)")
            continue
            
        print(f"  -> Processing {name}...")
        
        # 2. Generate Embedding
        text = format_hotel_for_embedding(hotel)
        embedding = await get_embedding(text)
        
        # 3. Update Database
        try:
            db.table("hotel_directory").update({
                "embedding": embedding
            }).eq("id", hotel_id).execute()
        except Exception as e:
            print(f"  [ERROR] Failed to update {name}: {e}")
            
    print("[Seed] Backfill complete!")

if __name__ == "__main__":
    asyncio.run(seed_embeddings())
