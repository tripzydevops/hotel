import os
import asyncio
import argparse
from typing import List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client
from backend.utils.embeddings import get_embedding

# Load Environment
load_dotenv()
load_dotenv(".env.local", override=True)

# Supabase Credentials
url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase URL or Service Role Key missing.")
    exit(1)

supabase: Client = create_client(url, key)

async def test_semantic_search(query: str, city_filter: str = None, limit: int = 5):
    print(f"\n[Semantic Search] Query: \"{query}\"")
    if city_filter:
        print(f"[Filter] City: {city_filter}")

    # 1. Generate Embedding for the query
    print("  ...Generating query embedding...")
    query_embedding = await get_embedding(query)
    
    # 2. Call the match_hotel_directory function (RPC)
    print("  ...Querying vector database...")
    try:
        rpc_params = {
            "query_embedding": query_embedding,
            "match_threshold": 0.5, # Relaxed for testing
            "match_count": limit,
            "city_filter": city_filter if city_filter != "None" else None
        }
        
        res = supabase.rpc("match_hotel_directory", rpc_params).execute()
        
        results = res.data or []
        
        if not results:
            print("  [No results found.]")
            return

        print(f"\n{'#'*40}")
        print(f"{'Similarity':<12} | {'Hotel Name':<30} | {'Location'}")
        print(f"{'-'*40}")
        for r in results:
            score = round(r.get('similarity', 0) * 100, 1)
            name = r.get('name', 'Unknown')
            location = r.get('location', 'Unknown')
            print(f"{score:>10}% | {name:<30} | {location}")
        print(f"{'#'*40}\n")
        
    except Exception as e:
        print(f"  [Error] Failed to execute RPC: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test real-time semantic search for hotels.")
    parser.add_argument("--query", type=str, required=True, help="Natural language search query.")
    parser.add_argument("--city", type=str, default=None, help="Optional city filter.")
    parser.add_argument("--limit", type=int, default=5, help="Number of results to return.")
    
    args = parser.parse_args()
    
    asyncio.run(test_semantic_search(args.query, args.city, args.limit))
