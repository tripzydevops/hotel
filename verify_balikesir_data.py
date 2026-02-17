
import os
from supabase import create_client, Client

url = "https://ztwkdawfdfbgusskqbns.supabase.co" # Corrected from .env
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Or SERVICE_ROLE

if not key:
    print("Error: SUPABASE_SERVICE_ROLE_KEY not found")
    exit(1)

supabase: Client = create_client(url, key)

city = "Balikesir"

print(f"Checking data for city: {city}")

# 1. Hotel Directory
dir_res = supabase.table("hotel_directory").select("*").ilike("location", f"%{city}%").execute()
print(f"Hotel Directory count: {len(dir_res.data)}")
for h in dir_res.data[:2]:
    print(f"  - {h['name']} ({h['id']}) - serp: {h.get('serp_api_id')}")

# 2. Tracked Hotels
tracked_res = supabase.table("hotels").select("*").ilike("location", f"%{city}%").execute()
print(f"Tracked Hotels count: {len(tracked_res.data)}")
tracked_ids = [h['id'] for h in tracked_res.data]
for h in tracked_res.data[:2]:
    print(f"  - {h['name']} ({h['id']})")

# 3. Price Logs for these hotels
if tracked_ids:
    price_res = supabase.table("price_logs").select("id", "hotel_id", "price", "currency", "search_rank").in_("hotel_id", tracked_ids).limit(5).execute()
    print(f"Price Logs sample count: {len(price_res.data)}")
    for p in price_res.data:
        print(f"  - Hotel {p['hotel_id']}: {p['price']} {p['currency']} (Rank: {p.get('search_rank')})")
else:
    print("No tracked hotels, so no price logs will be matched in admin_service logic.")
