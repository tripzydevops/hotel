
import asyncio
import os
import sys
import argparse
from datetime import datetime, timedelta
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client
from typing import Dict, List, Tuple, Any

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("[Error] Supabase credentials not found.")
    sys.exit(1)

supabase = create_client(url, key)

async def aggregate_daily_prices(days_retention: int = 90, dry_run: bool = False):
    print(f"\n[Aggregation] Starting aggregation policy (Retention: {days_retention} days)...")
    
    cutoff_date = datetime.utcnow() - timedelta(days=days_retention)
    cutoff_str = cutoff_date.isoformat()
    print(f"[Aggregation] Processing logs older than: {cutoff_date.strftime('%Y-%m-%d')}")
    
    # 1. Get Hotels that have old logs
    hotels_res = supabase.table("hotels").select("id, name").execute()
    hotels = hotels_res.data or []
    
    total_archived = 0
    total_deleted = 0
    
    for hotel in hotels:
        hotel_id = hotel["id"]
        hotel_name = hotel["name"]
        
        # 2. Fetch old logs for this hotel
        # We process in batches of 1000 to manage memory
        batch_size = 1000
        
        while True:
            # Fetch logs older than cutoff
            logs_res = (
                supabase.table("price_logs")
                .select("*")
                .eq("hotel_id", hotel_id)
                .lt("recorded_at", cutoff_str)
                .order("recorded_at", desc=False) # Oldest first
                .range(0, batch_size - 1)
                .execute()
            )
            
            logs = logs_res.data or []
            if not logs:
                break
                
            print(f"  → {hotel_name}: Found {len(logs)} old logs to aggregate.")
            
            # 3. Group by Date (YYYY-MM-DD) and Source
            grouped_data: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
            
            for log in logs:
                rec_at = log.get("recorded_at")
                if not rec_at: continue
                date_key = rec_at[:10] # YYYY-MM-DD
                source = log.get("source") or "google_hotels" # Default source
                grouped_data[(date_key, source)].append(log)
            
            # 4. Compute Aggregates
            entries_to_insert = []
            log_ids_to_delete: List[str] = []
            
            for (date_str, source), day_logs in grouped_data.items():
                prices = []
                room_stats: Dict[str, List[float]] = defaultdict(list) # room_name -> [prices]
                
                for log in day_logs:
                    log_ids_to_delete.append(str(log["id"]))
                    
                    # Main price
                    p = log.get("price")
                    if p is not None:
                        prices.append(float(p))
                        
                    # Room Types
                    rt_list = log.get("room_types") or []
                    if isinstance(rt_list, list):
                        for rt in rt_list:
                            if isinstance(rt, dict) and rt.get("name") and rt.get("price") is not None:
                                try:
                                    # Basic cleaning
                                    price_val = float(rt["price"])
                                    room_stats[rt["name"]].append(price_val)
                                except: pass

                if not prices and not room_stats:
                    continue
                    
                # Calculate Stats
                avg_price = sum(prices) / len(prices) if prices else None
                min_price = min(prices) if prices else None
                max_price = max(prices) if prices else None
                
                # Room Summary
                summary = {}
                for name, r_prices in room_stats.items():
                    summary[name] = {
                        "avg": sum(r_prices) / len(r_prices),
                        "min": min(r_prices),
                        "max": max(r_prices),
                        "count": len(r_prices)
                    }
                
                entries_to_insert.append({
                    "hotel_id": hotel_id,
                    "date": date_str,
                    "avg_price": avg_price,
                    "min_price": min_price,
                    "max_price": max_price,
                    "source": source,
                    "room_type_summary": summary
                })
            
            # 5. Insert into price_history_daily
            if entries_to_insert and not dry_run:
                try:
                    # Upsert to handle re-runs (if we crashed before delete)
                    supabase.table("price_history_daily").upsert(
                        entries_to_insert, 
                        on_conflict="hotel_id,date,source"
                    ).execute()
                    
                    total_archived += len(entries_to_insert)
                    
                    # 6. Delete processed logs
                    # Delete by IDs
                    # Batch delete is cleaner
                    chunk_size = 500
                    for i in range(0, len(log_ids_to_delete), chunk_size):
                        chunk = log_ids_to_delete[i:i+chunk_size]
                        supabase.table("price_logs").delete().in_("id", chunk).execute()
                        
                    total_deleted += len(log_ids_to_delete)
                    print(f"    ✓ Archived {len(entries_to_insert)} days, Deleted {len(log_ids_to_delete)} logs.")
                    
                except Exception as e:
                    print(f"    ✗ Error archiving/deleting: {e}")
                    # Stop processing this hotel if DB error to avoid data loss
                    break
            elif dry_run:
                print(f"    [DRY RUN] Would archive {len(entries_to_insert)} days, delete {len(log_ids_to_delete)} logs.")
                total_archived += len(entries_to_insert)
                total_deleted += len(log_ids_to_delete)
                # In dry run, we don't delete logs, so the next fetch would get the same logs.
                # Break to prevent infinite loop.
                break

    print(f"\n[Aggregation] COMPLETE")
    print(f"  Days Archived: {total_archived}")
    print(f"  Raw Logs Deleted: {total_deleted}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aggregate old price logs")
    parser.add_argument("--days", type=int, default=90, help="Retention period in days (default: 90)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without changes")
    args = parser.parse_args()
    
    asyncio.run(aggregate_daily_prices(days_retention=args.days, dry_run=args.dry_run))
