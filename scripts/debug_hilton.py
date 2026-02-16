
import json
from backend.utils.db import get_supabase

def debug_data():
    db = get_supabase()
    
    # 1. Inspect Hotel
    print("--- HOTELS (Hilton) ---")
    hotels = db.table('hotels').select('*').ilike('name', '%Hilton%').execute()
    print(json.dumps(hotels.data, indent=2, default=str))
    
    if hotels.data:
        hid = hotels.data[0]['id']
        # 2. Inspect Price Logs
        print(f"--- PRICES for {hid} ---")
        prices = db.table('price_logs').select('*').eq('hotel_id', hid).order('recorded_at', desc=True).limit(5).execute()
        print(json.dumps(prices.data, indent=2, default=str))
        
    # 3. Inspect Settings
    print("--- SETTINGS ---")
    settings = db.table('settings').select('*').execute()
    print(json.dumps(settings.data, indent=2, default=str))

    # 4. Inspect Sessions
    print("--- SESSIONS ---")
    sessions = db.table('scan_sessions').select('*').order('created_at', desc=True).limit(5).execute()
    print(json.dumps(sessions.data, indent=2, default=str))

if __name__ == "__main__":
    debug_data()
