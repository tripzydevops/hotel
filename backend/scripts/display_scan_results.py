import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import os
root_dir = r"C:\projects\hotelplus-vm"
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.utils.db import get_insforge_db, load_env_standard
load_env_standard()

db = get_insforge_db(admin=True)

print("=" * 80)
print(">>> HOTELPLUS LIVE GLOBAL SCAN RESULTS (2026-09-21) <<<")
print("=" * 80)

# Fetch all hotels for quick lookup
hotels_data = db.table('hotels').select('id, name, location, current_price, currency, rating, review_count, last_scanned_at, offers, room_types').execute().data or []
hotel_map = {h['id']: h for h in hotels_data}

# 1. Price Logs
logs = db.table('price_logs').select(
    'id, hotel_id, price, currency, vendor, source, check_in_date, check_out_date, recorded_at, is_anomaly, offers, room_types, parity_offers'
).order('recorded_at', desc=True).limit(10).execute().data or []

print(f"\n--- 1. LATEST PRICE LOGS ({len(logs)} records) ---")
for idx, pl in enumerate(logs, 1):
    h = hotel_map.get(pl.get('hotel_id'), {})
    h_name = h.get('name', pl.get('hotel_id'))
    offers = pl.get('offers') or []
    rooms = pl.get('room_types') or []
    anomaly_str = " [⚠️ ANOMALY FLAGGED]" if pl.get('is_anomaly') else ""

    print(f"\n[{idx}] {h_name}{anomaly_str}")
    print(f"    • Price: {pl.get('price')} {pl.get('currency')} | Vendor: {pl.get('vendor')} | Source: {pl.get('source')}")
    print(f"    • Dates: {pl.get('check_in_date')} to {pl.get('check_out_date')} | Recorded At: {pl.get('recorded_at')}")
    print(f"    • OTA Channels: {len(offers)} offers captured | Room Types: {len(rooms)} room variants")

    if offers:
        print("    • Sample OTA Rates:")
        for o in offers[:6]:
            ota_src = o.get('source') or o.get('vendor') or o.get('name') or 'Direct'
            ota_pr = o.get('price')
            ota_curr = o.get('currency', pl.get('currency'))
            print(f"        - {ota_src}: {ota_pr} {ota_curr}")

    if rooms:
        print("    • Sample Room Types:")
        for r in rooms[:5]:
            if isinstance(r, dict):
                r_name = r.get('name', 'Unknown')
                r_pr = r.get('price')
                r_curr = r.get('currency', pl.get('currency'))
                pr_str = f" - {r_pr} {r_curr}" if r_pr else ""
                print(f"        - {r_name}{pr_str}")
            else:
                print(f"        - {r}")

# 2. Hotel Reviews
print("\n" + "=" * 80)
print("--- 2. LATEST HOTEL REVIEWS CAPTURED ---")
reviews = db.table('hotel_reviews').select(
    'hotel_id, author, rating, text, review_date, recorded_at'
).order('recorded_at', desc=True).limit(10).execute().data or []

for idx, rv in enumerate(reviews, 1):
    h = hotel_map.get(rv.get('hotel_id'), {})
    h_name = h.get('name', rv.get('hotel_id'))
    txt = (rv.get('text') or '').strip().replace('\n', ' ')
    if len(txt) > 140:
        txt = txt[:140] + "..."
    print(f"\n[{idx}] {h_name} | Rating: {rv.get('rating')} | Author: {rv.get('author')}")
    print(f"    Date: {rv.get('review_date')} | Recorded: {rv.get('recorded_at')}")
    print(f"    Review: \"{txt}\"")

# 3. Monitored Properties Summary
print("\n" + "=" * 80)
print("--- 3. MONITORED PROPERTIES STATUS ---")
for h in hotels_data:
    if h.get('last_scanned_at'):
        offers_count = len(h.get('offers') or [])
        rooms_count = len(h.get('room_types') or [])
        print(f"• {h.get('name')} ({h.get('location')}):")
        print(f"    Price: {h.get('current_price')} {h.get('currency')} | Rating: {h.get('rating')} ({h.get('review_count')} reviews)")
        print(f"    OTAs: {offers_count} channels | Room Types: {rooms_count} | Last Scanned: {h.get('last_scanned_at')}")

# 4. Admin Settings Check
print("\n" + "=" * 80)
print("--- 4. SYSTEM SCHEDULER HEARTBEAT STATE ---")
admin = db.table('admin_settings').select('*').limit(1).execute().data
if admin:
    s = admin[0]
    print(f"• Last Global Scan At : {s.get('last_global_scan_at')}")
    print(f"• Next Global Scan At : {s.get('next_global_scan_at')}")
    print(f"• Scan Interval       : Every {s.get('scan_interval_hours', 4)} Hours")
