import os
import asyncio
from supabase import create_client
from datetime import datetime, timedelta

async def debug_market_intelligence(city="Balikesir"):
    url = "https://ztwkdawfdfbgusskqbns.supabase.co"
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
         # Try to get from .env if running locally
         with open(".env", "r") as f:
             for line in f:
                 if "SUPABASE_SERVICE_ROLE_KEY" in line:
                     key = line.split("=")[1].strip()
                     break
    
    db = create_client(url, key)
    
    print(f"--- Debugging Market Intelligence for {city} ---")
    
    # 1. Check Directory
    dir_res = db.table("hotel_directory").select("*").ilike("location", f"%{city}%").execute()
    directory_hotels = dir_res.data or []
    print(f"Found {len(directory_hotels)} hotels in directory for {city}")
    
    if directory_hotels:
        h = directory_hotels[0]
        print(f"Sample Directory Hotel: {h['name']} (Lat: {h.get('latitude')}, Lng: {h.get('longitude')})")

    # 2. Check Tracked Hotels
    tracked_res = db.table("hotels").select("*").ilike("location", f"%{city}%").execute()
    tracked_hotels = tracked_res.data or []
    print(f"Found {len(tracked_hotels)} tracked hotels for {city}")
    
    if tracked_hotels:
        h = tracked_hotels[0]
        print(f"Sample Tracked Hotel: {h['name']} (Lat: {h.get('latitude')}, Lng: {h.get('longitude')}, ID: {h['id']})")

    # 3. Check Price Logs for these hotels
    hotel_ids = [str(h["id"]) for h in tracked_hotels]
    if hotel_ids:
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        logs_res = db.table("price_logs").select("*").in_("hotel_id", hotel_ids).gte("recorded_at", thirty_days_ago).limit(10).execute()
        logs = logs_res.data or []
        print(f"Found {len(logs)} recent price logs for tracked hotels")
        if logs:
            l = logs[0]
            print(f"Sample Log: Price={l['price']}, Rank={l.get('search_rank')}, Date={l['recorded_at']}")
    else:
        print("No tracked hotels, skipping price log check.")

    # 4. Check coordinate overlap
    mapped_count = 0
    for dh in directory_hotels:
        matched = next((th for th in tracked_hotels if th["name"].lower() == dh["name"].lower()), None)
        lat = dh.get("latitude")
        lng = dh.get("longitude")
        if lat is None or lng is None:
            if matched:
                lat = matched.get("latitude")
                lng = matched.get("longitude")
        if lat is not None and lng is not None:
            mapped_count += 1
    
    print(f"Calculated Mapped Hotels: {mapped_count}")

if __name__ == "__main__":
    asyncio.run(debug_market_intelligence())
