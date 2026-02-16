"""
One-Time Migration: Backfill Legacy query_logs into price_logs
==============================================================

WHY: The architecture hardening removed the dual-query pattern that fetched
from both 'price_logs' (active) and 'query_logs' (legacy). However, most
hotels only had 2-4 entries in 'price_logs' while having 15-82 entries in
'query_logs'. Removing the fallback caused missing prices on the dashboard.

HOW: This script reads all price-bearing records from 'query_logs', maps
them to hotel IDs, and inserts them into 'price_logs' with a 'legacy_backfill'
source tag. This makes the single-source approach viable.

SAFETY: Uses upsert-like behavior — checks for existing records at the same
timestamp to avoid duplicates. Can be safely re-run.

USAGE: python3 backend/scripts/backfill_query_logs_to_price_logs.py
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from dotenv import load_dotenv
load_dotenv()
load_dotenv('.env.local', override=True)

from supabase import create_client

def main():
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("ERROR: Missing SUPABASE env vars")
        return
    
    db = create_client(url, key)
    
    # 1. Get all hotels (need ID <-> name mapping)
    hotels_res = db.table("hotels").select("id, name, user_id").execute()
    hotels = hotels_res.data or []
    if not hotels:
        print("No hotels found. Exiting.")
        return
    
    # EXPLANATION: Name-to-ID mapping for legacy records
    # query_logs stores hotel_name (text), price_logs stores hotel_id (UUID).
    # We build a lookup to convert between the two schemas.
    name_to_hotel = {}
    for h in hotels:
        name_to_hotel[h["name"]] = h
    
    hotel_names = list(name_to_hotel.keys())
    print(f"Found {len(hotels)} hotels. Fetching legacy query_logs...")
    
    # 2. Fetch all price-bearing query_logs
    query_logs_res = db.table("query_logs") \
        .select("hotel_name, price, currency, created_at, vendor, action_type") \
        .in_("hotel_name", hotel_names) \
        .in_("action_type", ["monitor", "search"]) \
        .not_.is_("price", "null") \
        .order("created_at", desc=True) \
        .execute()
    
    legacy_records = query_logs_res.data or []
    print(f"Found {len(legacy_records)} legacy price records.")
    
    if not legacy_records:
        print("No legacy records to migrate. Done.")
        return
    
    # 3. Get existing price_logs timestamps to avoid duplicates
    existing_timestamps = {}
    for h in hotels:
        hid = str(h["id"])
        pl_res = db.table("price_logs") \
            .select("recorded_at") \
            .eq("hotel_id", hid) \
            .execute()
        existing_timestamps[hid] = set(
            str(r["recorded_at"]) for r in (pl_res.data or [])
        )
    
    # 4. Convert and insert
    to_insert = []
    skipped = 0
    
    for ql in legacy_records:
        hotel = name_to_hotel.get(ql["hotel_name"])
        if not hotel:
            continue
        
        hid = str(hotel["id"])
        ts = str(ql["created_at"])
        
        # EXPLANATION: Duplicate Prevention
        # Skip if we already have a price_log at this exact timestamp
        if ts in existing_timestamps.get(hid, set()):
            skipped += 1
            continue
        
        # EXPLANATION: Schema Translation
        # query_logs has a flat structure; price_logs has structured fields.
        # We map the legacy fields to the modern schema.
        record = {
            "hotel_id": hid,
            "price": ql["price"],
            "currency": ql.get("currency") or "TRY",
            "recorded_at": ql["created_at"],
            "vendor": ql.get("vendor") or "SerpApi",
            "check_in_date": ql["created_at"].split("T")[0],  # Best approximation
            "source": "legacy_backfill",  # Tag for traceability
        }
        to_insert.append(record)
        existing_timestamps.setdefault(hid, set()).add(ts)
    
    print(f"Records to insert: {len(to_insert)} (skipped {skipped} duplicates)")
    
    if not to_insert:
        print("Nothing to insert. All records already exist.")
        return
    
    # 5. Batch insert (chunks of 100 for safety)
    batch_size = 100
    total_inserted = 0
    
    for i in range(0, len(to_insert), batch_size):
        batch = to_insert[i:i + batch_size]
        try:
            db.table("price_logs").insert(batch).execute()
            total_inserted += len(batch)
            print(f"  Inserted batch {i // batch_size + 1}: {len(batch)} records")
        except Exception as e:
            print(f"  ERROR on batch {i // batch_size + 1}: {e}")
            # Try one-by-one for error isolation
            for record in batch:
                try:
                    db.table("price_logs").insert(record).execute()
                    total_inserted += 1
                except Exception as inner_e:
                    print(f"    Single insert failed for {record['hotel_id']}: {inner_e}")
    
    print(f"\n✅ Migration complete! Inserted {total_inserted} records into price_logs.")
    
    # 6. Verify
    print("\n=== Post-Migration Counts ===")
    for h in hotels:
        hid = str(h["id"])
        pl = db.table("price_logs").select("id", count="exact").eq("hotel_id", hid).execute()
        print(f"  {h['name']}: {pl.count or 0} price_logs")

if __name__ == "__main__":
    main()
