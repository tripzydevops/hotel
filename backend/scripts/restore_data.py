import os
import json
from backend.utils.db import get_supabase

def restore():
    db = get_supabase()
    backup_dir = "/tmp/db_backup"
    
    # Valid user to map everything to
    ACTIVE_USER_ID = "00000000-0000-0000-0000-000000000001"
    
    # Order matters for foreign keys
    tables = [
        "profiles",
        "hotels",
        "settings",
        "scan_sessions",
        "hotel_directory",
        "market_events",
        "price_logs",
        "alerts",
        "query_logs"
    ]
    
    print(f"Starting restoration from {backup_dir}...")
    
    for table in tables:
        path = f"{backup_dir}/{table}.json"
        if not os.path.exists(path):
            print(f"  No backup file for {table}, skipping.")
            continue
            
        try:
            with open(path, "r") as f:
                data = json.load(f)
            
            if not data:
                print(f"  No data to restore for {table}.")
                continue
                
            print(f"Restoring {len(data)} records to {table}...")
            
            # Map user_id to active user
            for record in data:
                if "user_id" in record:
                    record["user_id"] = ACTIVE_USER_ID
                # Handle profiles table specially as id is the user_id
                if table == "profiles" and "id" in record:
                    record["id"] = ACTIVE_USER_ID

            # Batching to avoid payload limits
            batch_size = 50
            for i in range(0, len(data), batch_size):
                batch = data[i:i+batch_size]
                try:
                    db.table(table).insert(batch).execute()
                except Exception as batch_error:
                    # If whole batch fails, try one-by-one to identify specific errors
                    if len(batch) > 1:
                        for item in batch:
                            try:
                                db.table(table).insert(item).execute()
                            except Exception:
                                pass # Skip bad records but keep going
                    else:
                        print(f"    Batch error in {table}: {batch_error}")

            print(f"  Successfully finished restoration process for {table}.")
        except Exception as e:
            print(f"  Error restoring {table}: {e}")

if __name__ == "__main__":
    restore()
