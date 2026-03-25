import os
import json
from datetime import datetime
from backend.utils.db import get_supabase

def backup():
    db = get_supabase()
    tables = [
        "hotels", 
        "price_logs", 
        "alerts", 
        "query_logs", 
        "settings", 
        "scan_sessions", 
        "profiles", 
        "hotel_directory", 
        "market_events"
    ]
    
    backup_dir = "/tmp/db_backup"
    os.makedirs(backup_dir, exist_ok=True)
    
    print(f"Starting backup to {backup_dir}...")
    
    for table in tables:
        try:
            print(f"Backing up {table}...")
            res = db.table(table).select("*").execute()
            if res.data:
                with open(f"{backup_dir}/{table}.json", "w") as f:
                    json.dump(res.data, f, indent=2)
                print(f"  Saved {len(res.data)} records.")
            else:
                print(f"  No data found in {table}.")
        except Exception as e:
            print(f"  Error backing up {table}: {e}")

if __name__ == "__main__":
    backup()
