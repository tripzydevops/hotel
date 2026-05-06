import os
import sys
import asyncio
import time

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.utils.db import get_supabase
from backend.utils.embeddings import get_genai_client, format_hotel_for_embedding, get_embeddings_batch


async def update_hotel_embedding(supabase, hotel_id, embedding, name):
    try:
        supabase.table("hotel_directory").update({"embedding": embedding}).eq("id", hotel_id).execute()
        return True
    except Exception as e:
        print(f"    - [Error] Failed for {name}: {str(e)}")
        return False

async def backfill():
    print("[Hotel Embedding] Starting Resilient Batch Backfill (768-dim)...")
    supabase = get_supabase()
    if not supabase:
        print("[Error] Could not initialize Supabase client.")
        return
    
    batch_size = 50
    
    while True:
        print(f"[Hotel Embedding] Fetching next {batch_size} hotels...")
        # Using select("*") to be safe against schema mismatches
        response = supabase.table("hotel_directory").select("*") \
            .is_("embedding", "null") \
            .limit(batch_size).execute()
        
        hotels = response.data
        if not hotels:
            print("[Hotel Embedding] All hotels have embeddings. Backfill complete.")
            break
            
        print(f"  -> Processing {len(hotels)} hotels...")
        
        texts = [format_hotel_for_embedding(h) for h in hotels]
        embeddings = await get_embeddings_batch(texts)
        
        # Parallel updates to local InsForge/Supabase
        tasks = []
        for i, h in enumerate(hotels):
            tasks.append(update_hotel_embedding(supabase, h['id'], embeddings[i], h.get('name')))
            
        results = await asyncio.gather(*tasks)
        successful = sum(1 for r in results if r)
        print(f"  -> {successful}/{len(hotels)} updates successful.")
        
        # Increase sleep to avoid hitting quota
        await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(backfill())
