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

    for result in scraper_results:
        if result.get("status") != "success":
            continue

        hotel_id = result.get("hotel_id")
        if not hotel_id:
            continue

        hotel_context = hotel_map.get(hotel_id, {})

        # Extract room types from the scan result
        room_types = result.get("room_types") or []
        if not isinstance(room_types, list) or not room_types:
            continue

        # Check which room types already exist for this hotel
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

            # Calculate average price for this room type
            price = room.get("price")
            avg_price = float(price) if price and isinstance(price, (int, float)) else None

            # Generate semantic embedding
            room_dict = {
                "name": name,
                "price": avg_price or "N/A",
                "currency": room.get("currency", "TRY"),
                "sqm": room.get("sqm"),
                "amenities": room.get("amenities", []),
            }

            try:
                text = format_room_type_for_embedding(room_dict, hotel_context=hotel_context)
                embedding = await get_embedding(text)

                if not embedding or all(v == 0.0 for v in embedding):
                    print(f"[RoomTypeCatalog] ⚠ Failed to embed: {name}")
                    continue

                # Upsert into catalog
                db.table("room_type_catalog").upsert(
                    {
                        "hotel_id": hotel_id,
                        "original_name": name,
                        "embedding": embedding,
                        "avg_price": avg_price,
                        "currency": room.get("currency", "TRY"),
                    },
                    on_conflict="hotel_id,original_name",
                ).execute()

                new_count += 1
                print(f"[RoomTypeCatalog] ✓ New room type embedded: {name} ({hotel_context.get('name', 'Unknown')})")
                existing_names.add(name)  # Prevent duplicates within same scan

            except Exception as e:
                print(f"[RoomTypeCatalog] ✗ Error processing {name}: {e}")
                continue

    print(f"[RoomTypeCatalog] Done — {new_count} new, {skip_count} skipped (already cataloged)")
