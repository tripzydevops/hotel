import os
import sys
import asyncio
import time

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.utils.db import get_supabase
from backend.utils.embeddings import get_genai_client, format_hotel_for_embedding

async def get_embeddings_batch(texts: list[str], model: str = "gemini-embedding-001"):
    client = get_genai_client()
    if not client:
        return [[0.0] * 768 for _ in texts]
    
    max_retries = 5
    for attempt in range(max_retries):
        try:
            # Batch embedding call
            result = client.models.embed_content(
                model=model,
                contents=texts,
                config={
                    "task_type": "RETRIEVAL_DOCUMENT",
                    "output_dimensionality": 768,
                },
            )
            if not result or not result.embeddings:
                return [[0.0] * 768 for _ in texts]
            return [e.values for e in result.embeddings]
        except Exception as e:
            if "429" in str(e):
                wait_time = (2 ** attempt) + 1
                print(f"[Embedding] Rate limited (429). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                print(f"[Embedding] Batch Error: {e}")
                return [[0.0] * 768 for _ in texts]
    return [[0.0] * 768 for _ in texts]

async def update_hotel_embedding(supabase, hotel_id, embedding, name):
    try:
        supabase.table("hotel_directory").update({"embedding": embedding}).eq("id", hotel_id).execute()
        return True
    except Exception as e:
        print(f"    - [Error] Failed for {name}: {str(e)}")
        return False

async def backfill():
    print("[Hotel Embedding] Starting Resilient Batch Backfill (Free Tier Safe)...")
    supabase = get_supabase()
    if not supabase:
        print("[Error] Could not initialize Supabase client.")
        return
    
    batch_size = 10 # Safer for Free Tier
    
    while True:
        print(f"[Hotel Embedding] Fetching next {batch_size} stale hotels...")
        # Call RPC to get both NULL and Zero-Vector hotels
        try:
            response = supabase.rpc("get_stale_hotel_embeddings", {"batch_size": batch_size}).execute()
        except Exception as e:
            print(f"[Error] RPC Failed: {e}")
            break
            
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
            # Only update if the returned embedding is valid (not null or all zeros)
            if any(v != 0.0 for v in embeddings[i]):
                tasks.append(update_hotel_embedding(supabase, h['id'], embeddings[i], h.get('name')))
            else:
                print(f"    - [Skipped] {h.get('name')} (received zero-vector from API)")
            
        if tasks:
            results = await asyncio.gather(*tasks)
            successful = sum(1 for r in results if r)
            print(f"  -> {successful}/{len(tasks)} updates successful.")
        
        # Increase sleep for Free Tier (15 requests per minute limit)
        print(f"  -> Sleeping 10s (Free Tier Safe Delay)...")
        await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(backfill())
