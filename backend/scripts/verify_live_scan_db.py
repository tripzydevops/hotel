
import os
import sys
from dotenv import load_dotenv
sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

from backend.utils.db import get_supabase
db = get_supabase()

user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"

print("Fetching hotels for tripzydevops...")
hotels_res = db.table("hotels").select("id, name").eq("user_id", user_id).execute()
hotel_ids = [h["id"] for h in hotels_res.data]
hotel_map = {h["id"]: h["name"] for h in hotels_res.data}

if not hotel_ids:
    print("No hotels found.")
    sys.exit(1)

print(f"Fetching latest price logs for {len(hotel_ids)} hotels...")
res = db.table("price_logs").select("*").in_("hotel_id", hotel_ids).order("recorded_at", desc=True).limit(10).execute()

if res.data:
    for log in res.data:
        hotel_id = log.get("hotel_id")
        price = log.get("price")
        vendor = log.get("vendor")
        offers = log.get("parity_offers") or log.get("offers") or []
        created_at = log.get("created_at")
        
        print(f"Time: {created_at} | Hotel: {hotel_id} | Price: {price} | Vendor: {vendor} | Offers: {len(offers)}")
        if len(offers) > 1:
            print(f"  [SUCCESS] Market depth found: {len(offers)} offers")
            for o in offers[:3]:
                print(f"    - {o.get('vendor')}: {o.get('price')}")
        else:
            print("  [WARNING] Only 1 offer found.")
else:
    print("No price logs found.")
