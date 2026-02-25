
import asyncio
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Use absolute path for robustness
dotenv_path = os.path.join(os.getcwd(), '.env.local')
load_dotenv(dotenv_path)

async def check_embeddings():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        print(f"Missing Supabase credentials. URL: {bool(url)}, Key: {bool(key)}")
        return

    supabase: Client = create_client(url, key)
    
    print("Fetching hotels with sentiment_embedding...")
    res = supabase.table("hotels").select("id, name, sentiment_embedding").execute()
    
    for hotel in res.data:
        emb = hotel.get("sentiment_embedding")
        if emb:
            print(f"Hotel: {hotel['name']} ({hotel['id']})")
            print(f"  Type: {type(emb)}")
            if isinstance(emb, str):
                print(f"  Length: {len(emb)}")
                print(f"  Start: {emb[:500]}...")
            elif isinstance(emb, list):
                print(f"  List Size: {len(emb)}")
                if len(emb) > 0:
                    print(f"  First Element Type: {type(emb[0])}")
                    print(f"  First Element: {emb[0]}")
        else:
            print(f"Hotel: {hotel['name']} ({hotel['id']}) - No embedding")

if __name__ == "__main__":
    asyncio.run(check_embeddings())
