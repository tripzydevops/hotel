
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load vars
load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials missing.")
    sys.exit(1)

supabase = create_client(url, key)

# Define what we EXPECT based on frontend/backend code usage
EXPECTED_SCHEMA = {
    "user_profiles": {
        "required": [
            "user_id", "display_name", "email", 
            "role", "plan_type", "subscription_status", 
            "trial_ends_at", "subscription_end_date",
            "company_name", "job_title", "phone", "timezone"
        ]
    },
    "hotels": {
        "required": [
            "id", "user_id", "name", "location", "serp_api_id",
            "is_target_hotel", "preferred_currency", "created_at"
        ]
    },
    "scan_sessions": {
        "required": [
            "id", "user_id", "status", "hotels_count", "session_type",
            "created_at", "completed_at", "check_in_date", "check_out_date", "adults", "currency"
        ]
    },
    "admin_settings": {
        "required": ["maintenance_mode", "signup_enabled", "default_currency"]
    },
    "price_logs": {
        "required": [
            "hotel_id", "price", "currency", "recorded_at", 
            "source", "check_in_date", "vendor", "offers", "room_types"
        ]
    },
    "query_logs": {
        "required": [
            "user_id", "hotel_name", "location", "action_type", 
            "status", "created_at", "session_id", "vendor", "price",
            "check_in_date", "adults"
        ]
    }
}

def check_schema():
    print("=== Database Schema Audit ===")
    
    issues_found = 0
    
    for table, expectations in EXPECTED_SCHEMA.items():
        print(f"\n[Table: {table}]")
        
        # 1. Fetch actual columns
        try:
            # We use a trick: select * limit 0 to get keys, or just limit 1 if empty
            res = supabase.table(table).select("*").limit(1).execute()
            
            # If table has rows, we get keys. If not, we might get empty list.
            if len(res.data) > 0:
                actual_cols = set(res.data[0].keys())
            else:
                # If valid table but empty, we can't easily see columns with py client 
                # without inserting dummy. 
                # Alternate: Try to update a dummy ID with all expected keys and see which fail?
                # For now, let's assume we can't fully audit empty tables safely without admin API.
                print("  ⚠️ Table is empty, skipping column verification (requires SQL inspection).")
                continue
                
            required = expectations["required"]
            missing = [col for col in required if col not in actual_cols]
            
            if missing:
                print(f"  [X] MISSING COLUMNS: {', '.join(missing)}")
                issues_found += 1
            else:
                print("  [OK] All critical columns present.")
                
        except Exception as e:
            print(f"  [X] Error accessing table: {e}")
            issues_found += 1

    print("\n" + "="*30)
    if issues_found > 0:
        print(f"Audit Complete: {issues_found} issues detected.")
    else:
        print("Audit Complete: Schema looks healthy (based on non-empty tables).")

if __name__ == "__main__":
    check_schema()
