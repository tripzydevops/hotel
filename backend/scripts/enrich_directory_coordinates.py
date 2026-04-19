"""
Enrich Hotel Directory with GPS Coordinates
============================================
Uses DataForSEO Google Maps SERP (live/advanced, 1 task each)
to look up coordinates for each hotel by name + location_code.

Processes sequentially with rate limiting.

Usage:
    python backend/scripts/enrich_directory_coordinates.py [--dry-run] [--limit N]
"""
import sys
import os
import io
import time
import argparse
import json

# Force unbuffered output for nohup/background runs
os.environ['PYTHONUNBUFFERED'] = '1'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", line_buffering=True)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from backend.utils.db import get_supabase_client, load_env_standard

load_env_standard()
supabase = get_supabase_client()

import aiohttp
import asyncio
import base64

DFSEO_LOGIN = os.getenv("DATAFORSEO_LOGIN", os.getenv("DFSEO_LOGIN", ""))
DFSEO_PASSWORD = os.getenv("DATAFORSEO_PASSWORD", os.getenv("DFSEO_PASSWORD", ""))
API_BASE = "https://api.dataforseo.com/v3"


def get_auth_header():
    creds = f"{DFSEO_LOGIN}:{DFSEO_PASSWORD}"
    return base64.b64encode(creds.encode()).decode()


async def search_hotel_maps(session, hotel, headers):
    """Search Google Maps for a single hotel and return coordinates."""
    url = f"{API_BASE}/serp/google/maps/live/advanced"
    
    loc_code = hotel.get("location_code") or 2792
    
    payload = [{
        "keyword": hotel["name"],
        "location_code": loc_code,
        "language_code": "en",
        "depth": 1,
    }]
    
    try:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                return None, None
            
            data = await resp.json()
            tasks = data.get("tasks", [])
            if not tasks or tasks[0].get("status_code") != 20000:
                return None, None
            
            results = tasks[0].get("result", [])
            if not results:
                return None, None
            
            items = results[0].get("items", [])
            if not items:
                return None, None
            
            hotel_lower = hotel["name"].lower().strip()
            
            # Best match: name contains or is contained
            for item in items:
                title = (item.get("title") or "").lower().strip()
                lat = item.get("latitude")
                lng = item.get("longitude")
                if not lat or not lng:
                    continue
                
                # Name similarity check
                hotel_words = set(hotel_lower.split())
                title_words = set(title.split())
                overlap = hotel_words & title_words
                
                if (title == hotel_lower or
                    hotel_lower in title or 
                    title in hotel_lower or
                    len(overlap) >= min(2, len(hotel_words))):
                    return lat, lng
            
            # Fallback: first hotel-category result
            for item in items:
                lat = item.get("latitude")
                lng = item.get("longitude")
                cat = (item.get("category") or "").lower()
                if lat and lng and ("hotel" in cat or "otel" in cat or "resort" in cat or "pension" in cat or "apart" in cat):
                    return lat, lng
            
            return None, None
    except Exception as e:
        return None, None


async def process_concurrent_batch(session, headers, batch, dry_run=False):
    """Process a batch of hotels concurrently (max 5 concurrent requests)."""
    semaphore = asyncio.Semaphore(5)
    
    async def limited_search(hotel):
        async with semaphore:
            lat, lng = await search_hotel_maps(session, hotel, headers)
            await asyncio.sleep(0.2)  # Small delay per request
            return hotel, lat, lng
    
    tasks = [limited_search(h) for h in batch]
    results = await asyncio.gather(*tasks)
    
    updated = 0
    for hotel, lat, lng in results:
        if lat and lng:
            if not dry_run:
                try:
                    supabase.table("hotel_directory").update({
                        "latitude": lat,
                        "longitude": lng
                    }).eq("id", hotel["id"]).execute()
                except Exception as e:
                    print(f"  [DB ERROR] {hotel['name']}: {e}")
                    continue
            print(f"  ✅ {hotel['name']} → ({lat:.6f}, {lng:.6f})", flush=True)
            updated += 1
        else:
            print(f"  ❌ {hotel['name']}", flush=True)
    
    return updated


async def main_async(dry_run=False, limit=None):
    print("Fetching hotels without coordinates...")
    all_hotels = []
    page_size = 1000
    offset = 0
    
    while True:
        result = (
            supabase.table("hotel_directory")
            .select("id, name, location, resolved_location_name, location_code")
            .is_("latitude", "null")
            .not_.is_("location_code", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not result.data:
            break
        all_hotels.extend(result.data)
        offset += page_size
        if len(result.data) < page_size:
            break
    
    if limit:
        all_hotels = all_hotels[:limit]
    
    print(f"Found {len(all_hotels)} hotels needing coordinates.\n", flush=True)
    
    if not all_hotels:
        print("Nothing to do!")
        return
    
    headers = {
        "Authorization": f"Basic {get_auth_header()}",
        "Content-Type": "application/json"
    }
    
    batch_size = 50  # 50 concurrent per batch, with semaphore(5) = 5 at a time
    total_updated = 0
    total_batches = (len(all_hotels) + batch_size - 1) // batch_size
    
    connector = aiohttp.TCPConnector(limit=10)
    async with aiohttp.ClientSession(connector=connector) as session:
        for i in range(0, len(all_hotels), batch_size):
            batch = all_hotels[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            pct = int(batch_num / total_batches * 100)
            print(f"\n📦 Batch {batch_num}/{total_batches} ({len(batch)} hotels) [{pct}%]", flush=True)
            
            updated = await process_concurrent_batch(session, headers, batch, dry_run)
            total_updated += updated
            
            # Pause between batches  
            if i + batch_size < len(all_hotels):
                print("  ⏳ Rate limiting (2s)...")
                await asyncio.sleep(2)
    
    print(f"\n{'='*60}", flush=True)
    print(f"DONE: {'Would update' if dry_run else 'Updated'} {total_updated}/{len(all_hotels)} hotels with coordinates.", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Enrich hotel_directory with GPS coordinates")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing")
    parser.add_argument("--limit", type=int, default=None, help="Max hotels to process")
    args = parser.parse_args()
    
    asyncio.run(main_async(dry_run=args.dry_run, limit=args.limit))


if __name__ == "__main__":
    main()
