"""
Room Type Catalog Service
=========================
Handles automatic population of the room_type_catalog table
during scan cycles. Extracts room types from scraper results
and generates semantic embeddings for cross-hotel room matching.

This runs as Phase 2.5 in the scan pipeline:
  Scraper → Analyst → **RoomTypeCatalog** → Notifier
"""

import os
import sys
from typing import List, Dict, Any, Optional

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.utils.embeddings import get_embedding, format_room_type_for_embedding


async def update_room_type_catalog(
    db,
    scraper_results: List[Dict[str, Any]],
    hotels: List[Dict[str, Any]]
):
    """
    Extracts room types from scan results and upserts them into
    room_type_catalog with semantic embeddings.
    
    Called automatically after each scan cycle. Only embeds NEW room types
    that don't already exist in the catalog — keeps API costs minimal.
    
    Args:
        db: Supabase client
        scraper_results: Results from ScraperAgent.run_scan()
        hotels: List of hotel dicts with id, name, stars, location
    """
    hotel_map = {h["id"]: h for h in hotels}
    new_count = 0
    skip_count = 0
    embedding_queue = [] # List of (room_dict, hotel_context, original_name, hotel_id)

    # 1. Collect all room types that need embeddings
    for result in scraper_results:
        if result.get("status") != "success":
            continue

        hotel_id = result.get("hotel_id")
        if not hotel_id:
            continue

        hotel_context = hotel_map.get(hotel_id, {})
        room_types = result.get("room_types") or []
        if not isinstance(room_types, list) or not room_types:
            continue

        try:
            existing_res = (
                db.table("room_type_catalog")
                .select("original_name")
                .eq("hotel_id", hotel_id)
                .execute()
            )
            existing_names = {r["original_name"] for r in (existing_res.data or [])}
        except Exception:
            existing_names = set()

        for room in room_types:
            name = room.get("name", "").strip()
            if not name or name in existing_names:
                skip_count += 1
                continue

            price = room.get("price")
            avg_price = float(price) if price and isinstance(price, (int, float)) else None

            room_dict = {
                "name": name,
                "price": avg_price or "N/A",
                "currency": room.get("currency", "TRY"),
                "sqm": room.get("sqm"),
                "amenities": room.get("amenities", []),
            }
            
            embedding_queue.append({
                "room_dict": room_dict,
                "hotel_context": hotel_context,
                "original_name": name,
                "hotel_id": hotel_id,
                "avg_price": avg_price,
                "currency": room.get("currency", "TRY")
            })
            existing_names.add(name)

    # 2. Process embeddings in parallel
    if embedding_queue:
        import asyncio
        import time
        start_time = time.time()
        print(f"[RoomTypeCatalog] Generating {len(embedding_queue)} embeddings in parallel...")
        
        async def get_and_pack(item):
            try:
                text = format_room_type_for_embedding(item["room_dict"], hotel_context=item["hotel_context"])
                embedding = await get_embedding(text)
                if embedding and not all(v == 0.0 for v in embedding):
                    return {
                        "hotel_id": item["hotel_id"],
                        "original_name": item["original_name"],
                        "embedding": embedding,
                        "avg_price": item["avg_price"],
                        "currency": item["currency"]
                    }
            except Exception as e:
                print(f"[RoomTypeCatalog] Embedding error for {item['original_name']}: {e}")
            return None

        tasks = [get_and_pack(item) for item in embedding_queue]
        results = await asyncio.gather(*tasks)
        
        valid_upserts = [r for r in results if r is not None]
        
        # 3. Batch Upsert
        if valid_upserts:
            try:
                # Supabase handles batch upserts via list of dicts
                db.table("room_type_catalog").upsert(
                    valid_upserts,
                    on_conflict="hotel_id,original_name"
                ).execute()
                new_count = len(valid_upserts)
                duration = time.time() - start_time
                print(f"[RoomTypeCatalog] ✓ Batch upsert complete: {new_count} items in {duration:.2f}s")
            except Exception as e:
                print(f"[RoomTypeCatalog] ✗ Batch upsert failed: {e}")
                
    print(f"[RoomTypeCatalog] Done — {new_count} new, {skip_count} skipped")
