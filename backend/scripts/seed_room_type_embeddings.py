"""
Backfill script: Seed Room Type Embeddings
==========================================
Scans existing price_logs for room types and populates the room_type_catalog
table with semantic embeddings for cross-hotel room matching.

Usage:
    python -m backend.scripts.seed_room_type_embeddings
"""

import asyncio
import os
import sys
from dotenv import load_dotenv

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client
from backend.utils.embeddings import get_embedding, format_room_type_for_embedding


async def seed_room_type_embeddings():
    """
    Main backfill function.
    1. Fetches all price_logs that contain room_types JSONB data
    2. Extracts unique room names per hotel
    3. Generates embeddings for each unique room type
    4. Upserts into room_type_catalog
    """
    print("[Seed Room Types] Starting room type embedding backfill...")

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("[Seed Room Types] ERROR: Missing Supabase credentials.")
        return

    supabase = create_client(url, key)

    # 1. Fetch all hotels
    hotels_response = supabase.table("hotels").select("id, name, stars, location").execute()
    hotels = hotels_response.data or []
    print(f"[Seed Room Types] Found {len(hotels)} hotels.")

    hotel_map = {h["id"]: h for h in hotels}
    total_embedded = 0
    total_skipped = 0

    for hotel in hotels:
        hotel_id = hotel["id"]
        hotel_name = hotel.get("name", "Unknown")
        print(f"\n[Seed Room Types] Processing: {hotel_name} ({hotel_id[:8]}...)")

        # 2. Fetch recent price_logs with room_types for this hotel
        logs_response = (
            supabase.table("price_logs")
            .select("room_types")
            .eq("hotel_id", hotel_id)
            .not_.is_("room_types", "null")
            .order("recorded_at", desc=True)
            .limit(50)
            .execute()
        )
        logs = logs_response.data or []

        if not logs:
            print(f"  → No price_logs with room_types found. Skipping.")
            continue

        # 3. Extract unique room names and calculate avg price
        room_stats = {}  # name -> { prices: [], count: 0 }
        for log in logs:
            room_types = log.get("room_types") or []
            if not isinstance(room_types, list):
                continue
            for room in room_types:
                name = room.get("name", "").strip()
                if not name:
                    continue
                if name not in room_stats:
                    room_stats[name] = {"prices": [], "count": 0}
                room_stats[name]["count"] += 1
                price = room.get("price")
                if price and isinstance(price, (int, float)):
                    room_stats[name]["prices"].append(price)

        if not room_stats:
            print(f"  → No valid room types extracted. Skipping.")
            continue

        print(f"  → Found {len(room_stats)} unique room types.")

        # 4. Check which already exist in catalog
        existing_response = (
            supabase.table("room_type_catalog")
            .select("original_name")
            .eq("hotel_id", hotel_id)
            .execute()
        )
        existing_names = {r["original_name"] for r in (existing_response.data or [])}

        # 5. Generate embeddings for new room types
        for room_name, stats in room_stats.items():
            if room_name in existing_names:
                total_skipped += 1
                continue

            avg_price = (
                sum(stats["prices"]) / len(stats["prices"])
                if stats["prices"]
                else None
            )

            # Build room dict for embedding
            room_dict = {
                "name": room_name,
                "price": avg_price or "N/A",
                "currency": "TRY",
            }

            # Format and embed
            text = format_room_type_for_embedding(room_dict, hotel_context=hotel)
            embedding = await get_embedding(text)

            if not embedding or all(v == 0.0 for v in embedding):
                print(f"  ⚠ Failed to embed: {room_name}")
                continue

            # 6. Upsert into room_type_catalog
            try:
                supabase.table("room_type_catalog").upsert(
                    {
                        "hotel_id": hotel_id,
                        "original_name": room_name,
                        "embedding": embedding,
                        "avg_price": avg_price,
                        "currency": "TRY",
                    },
                    on_conflict="hotel_id,original_name",
                ).execute()
                total_embedded += 1
                print(f"  ✓ Embedded: {room_name} (avg: {avg_price:.0f} TRY)" if avg_price else f"  ✓ Embedded: {room_name}")
            except Exception as e:
                print(f"  ✗ Error upserting {room_name}: {e}")

    print(f"\n{'='*50}")
    print(f"[Seed Room Types] COMPLETE")
    print(f"  Embedded: {total_embedded}")
    print(f"  Skipped (already exist): {total_skipped}")
    print(f"{'='*50}")


if __name__ == "__main__":
    asyncio.run(seed_room_type_embeddings())
