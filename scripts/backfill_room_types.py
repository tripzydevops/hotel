
import asyncio
import json
from backend.utils.db import get_supabase
from backend.utils.room_normalizer import RoomTypeNormalizer

async def backfill_room_types():
    db = get_supabase()
    print("Starting Room Type Backfill...")
    
    # 1. Fetch records that need normalization
    # We can't easily check for 'canonical_code' inside JSON array via simple API filter effectively without index.
    # So let's fetch batches of recent logs.
    
    page_size = 100
    page = 0
    total_updated = 0
    
    while True:
        print(f"Fetching page {page}...")
        res = db.table("price_logs") \
            .select("id, room_types") \
            .not_.is_("room_types", "null") \
            .order("recorded_at", desc=True) \
            .range(page * page_size, (page + 1) * page_size - 1) \
            .execute()
            
        if not res.data:
            break
            
        updates = []
        for row in res.data:
            rooms = row.get("room_types")
            if not rooms:
                continue
                
            needs_update = False
            normalized_rooms = []
            
            for room in rooms:
                if not isinstance(room, dict):
                    continue
                    
                # If already normalized, skip (check if 'canonical_code' exists)
                if "canonical_code" in room:
                    normalized_rooms.append(room)
                    continue
                
                raw_name = room.get("name")
                if not raw_name:
                    normalized_rooms.append(room)
                    continue
                    
                norm = RoomTypeNormalizer.normalize(raw_name)
                room["canonical_code"] = norm["canonical_code"]
                room["canonical_name"] = norm["canonical_name"]
                normalized_rooms.append(room)
                needs_update = True
                
            if needs_update:
                # Update the row
                # We do one-by-one update because bulk update with different values is tricky via API
                # Or we can batch them if Supabase py client supports upsert with ID?
                # For safety, let's do sequential or create a list of updates.
                try:
                    db.table("price_logs").update({"room_types": normalized_rooms}).eq("id", row["id"]).execute()
                    total_updated += 1
                except Exception as e:
                    print(f"Failed to update {row['id']}: {e}")
                    
        print(f"Page {page} processed. Updated {len(updates)} records locally (count {total_updated} total).")
        page += 1
        
        # Limit for this run to avoid timeout/overload
        if page > 10: 
            print("Stopping after 1000 records for safety.")
            break

    print(f"Backfill complete. Total records updated: {total_updated}")

if __name__ == "__main__":
    asyncio.run(backfill_room_types())
