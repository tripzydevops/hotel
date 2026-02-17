import os
import asyncio
from supabase import create_client
from datetime import datetime, timedelta

async def simulate_admin_intelligence(city="Balikesir"):
    url = "https://ztwkdawfdfbgusskqbns.supabase.co"
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
         with open(".env", "r") as f:
             for line in f:
                 if "SUPABASE_SERVICE_ROLE_KEY" in line:
                     key = line.split("=")[1].strip()
                     break
    
    db = create_client(url, key)
    
    # Simulate directory fetch
    dir_res = db.table("hotel_directory").select("*").ilike("location", f"%{city}%").execute()
    directory_hotels = dir_res.data or []
    
    # Simulate tracked fetch
    tracked_res = db.table("hotels").select("*").execute()
    tracked_hotels = tracked_res.data or []
    # Local filter for city
    tracked_in_city = [h for h in tracked_hotels if city.lower() in (h.get("location") or "").lower()]
    
    print(f"Directory count: {len(directory_hotels)}")
    print(f"Tracked in city count: {len(tracked_in_city)}")
    
    # Latest Price Logic (THE BUGGY PART)
    tracked_ids = [str(h["id"]) for h in tracked_in_city]
    if tracked_ids:
        latest_prices_res = db.table("price_logs") \
            .select("hotel_id, price") \
            .in_("hotel_id", tracked_ids) \
            .order("recorded_at", desc=True) \
            .limit(len(tracked_ids)) \
            .execute()
        
        price_map = {str(p["hotel_id"]): p["price"] for p in latest_prices_res.data} if latest_prices_res.data else {}
        print(f"Price map keys: {list(price_map.keys())}")
        print(f"Price map coverage: {len(price_map)}/{len(tracked_ids)}")
    
    # Visibility Logic
    hotel_ids_for_vis = [str(h["id"]) for h in tracked_in_city]
    if hotel_ids_for_vis:
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        vis_query = db.table("price_logs") \
            .select("recorded_at, search_rank, price") \
            .in_("hotel_id", hotel_ids_for_vis) \
            .gte("recorded_at", thirty_days_ago) \
            .order("recorded_at", desc=False) \
            .execute()
        
        raw_vis = vis_query.data or []
        print(f"Raw visibility logs count: {len(raw_vis)}")
        
        if raw_vis:
            has_any_rank = any(e.get("search_rank") is not None for e in raw_vis)
            print(f"Has any real rank: {has_any_rank}")
            
            # Simulate aggregation
            daily_aggregates = {}
            # (Applying the synthetic fallback here)
            if not has_any_rank:
                by_date = {}
                for e in raw_vis:
                    d = e["recorded_at"].split("T")[0]
                    if d not in by_date: by_date[d] = []
                    by_date[d].append(e)
                for d, entries in by_date.items():
                    sorted_entries = sorted(entries, key=lambda x: x.get("price", 999999))
                    for i, e in enumerate(sorted_entries):
                        e["search_rank"] = i + 1
            
            for entry in raw_vis:
                if entry.get("search_rank") is None or not entry.get("recorded_at"):
                    continue
                dt_str = entry["recorded_at"].split("T")[0]
                if dt_str not in daily_aggregates:
                    daily_aggregates[dt_str] = {"sum_rank": 0, "count": 0, "sum_price": 0}
                daily_aggregates[dt_str]["sum_rank"] += entry["search_rank"]
                daily_aggregates[dt_str]["count"] += 1
            
            print(f"Aggregated visibility days: {len(daily_aggregates)}")
            print(f"Sample aggregation: {list(daily_aggregates.items())[:1]}")

if __name__ == "__main__":
    asyncio.run(simulate_admin_intelligence())
