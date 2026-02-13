
import asyncio
import os
from uuid import UUID
from backend.services.hotel_service import search_hotel_directory_logic
from backend.utils.db import get_supabase
from dotenv import load_dotenv

async def test_search():
    load_dotenv()
    load_dotenv(".env.local", override=True)
    
    db = get_supabase()
    if not db:
        print("Failed to initialize Supabase")
        return

    print("\n--- 3-Letter Search for 'alt' ---")
    results = await search_hotel_directory_logic("alt", None, db)
    for r in results:
        print(f"Match: {r['name']} | {r.get('location')} | {r.get('source', 'local')}")

    print("\n--- Logic Search for 'Altin Hotel Balikesir' ---")
    results = await search_hotel_directory_logic("Altin Hotel Balikesir", None, db)
    for r in results:
        print(f"Match: {r['name']} | {r.get('location')} | {r.get('source', 'local')}")

    print("\n--- RAW SerpApi Search for 'Altin Hotel Balikesir' ---")
    from backend.services.serpapi_client import serpapi_client
    raw_results = await serpapi_client.search_hotels("Altin Hotel Balikesir", limit=10)
    for r in raw_results:
        print(f"Raw Match: {r['name']} | {r.get('location')} | Stars: {r.get('stars')}")

    print("\n--- Searching for 'Hilton Hotel Balikesir' ---")
    results = await search_hotel_directory_logic("Hilton Hotel Balikesir", None, db)
    for r in results:
        print(f"Match: {r['name']} | {r.get('location')} | {r.get('source', 'local')}")

if __name__ == "__main__":
    asyncio.run(test_search())
