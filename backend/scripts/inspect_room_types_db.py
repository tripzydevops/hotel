
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

print(f"Fetching latest price logs for {len(hotel_ids)} hotels...")
res = db.table("price_logs").select("*").in_("hotel_id", hotel_ids).order("recorded_at", desc=True).limit(20).execute()

if res.data:
    # Get one log per hotel
    seen = set()
    for log in res.data:
        hid = log.get("hotel_id")
        if hid in seen: continue
        seen.add(hid)
        
        name = hotel_map.get(hid, "Unknown")
        r_types = log.get("room_types") or []
        print(f"\nHotel: {name} ({hid})")
        print(f"Top-level Price: {log.get('price')} {log.get('currency')}")
        if r_types:
            print(f"Room Types ({len(r_types)}):")
            for r in r_types[:5]:
                print(f"  - {r.get('name')}: {r.get('price')}")
        else:
            print("No room types found.")
else:
    print("No logs found.")
