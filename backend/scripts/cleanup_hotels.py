"""
Script to delete 'orphaned' hotels from the database.

CRITICAL SAFETY GUARDS (Lessons from Ramada Incident - Feb 2026):
1. DRY RUN BY DEFAULT: Script only lists candidates unless --force is used.
2. ACTIVE USER PROTECTION: Hotels belonging to users in user_profiles are NEVER deleted.
3. TARGET HOTEL PROTECTION: Hotels with is_target_hotel=True are NEVER deleted.
4. TOKEN REQUIREMENT: Only hotels missing BOTH property_token AND serp_api_id are considered.

Purpose: Purge hotels that cannot be scanned (useless) but protect ALL user data.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
# Load from project root .env.local
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env.local")
load_dotenv(env_path)

from supabase import create_client

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing Supabase credentials")
    sys.exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)

# EXPLANATION: Safety Mode Toggle
# Why: To prevent accidental data loss, we require an explicit --force flag.
# Without it, the script only performs a dry-run.
DRY_RUN = "--force" not in sys.argv

# Step 1: Find candidates and fetch Active User list
print("=" * 60)
print("IDENTIFYING CANDIDATES FOR CLEANUP")
if DRY_RUN:
    print("MODE: DRY RUN (No deletions will be performed)")
else:
    print("MODE: LIVE DELETION (!!!)")
print("=" * 60)

# Fetch all hotels (including is_target_hotel flag for safety)
all_hotels = db.table("hotels").select("id, name, user_id, property_token, serp_api_id, is_target_hotel, created_at").execute()

# Fetch all valid user profiles (Active/Registered users)
# We protect ANY hotel belonging to a user that has a profile.
profiles_res = db.table("user_profiles").select("user_id").execute()
active_user_ids = {str(p["user_id"]) for p in (profiles_res.data or [])}

hotels_to_delete = []
for h in all_hotels.data or []:
    name = h.get("name") or "Unknown"
    hid = h["id"]
    uid = str(h.get("user_id", ""))
    
    # 1. Check for valid tracking tokens
    has_token = h.get("property_token") or h.get("serp_api_id")
    
    # 2. Check for Target status
    is_target = h.get("is_target_hotel", False)
    
    # 3. Check for Active User ownership
    is_active_user_owned = uid in active_user_ids
    
    # THE REJECTION LOGIC (The Safety Fence)
    if not has_token:
        # Candidate for deletion, BUT check layers of protection first
        if is_target:
            print(f"  [SAFE] {name} (ID: {hid[:8]}...): Protected as TARGET HOTEL.")
        elif is_active_user_owned:
            print(f"  [SAFE] {name} (ID: {hid[:8]}...): Protected as ACTIVE USER property ({uid[:8]}...).")
        else:
            hotels_to_delete.append(h)
            print(f"  - {name} (ID: {hid[:8]}..., User: {uid[:8]}...) -> CANDIDATE")

print()
print(f"Total candidates for deletion: {len(hotels_to_delete)}")
print(f"Total protected/kept hotels: {len(all_hotels.data or []) - len(hotels_to_delete)}")
print()

if not hotels_to_delete:
    print("No insecure hotels found to delete.")
    sys.exit(0)

if DRY_RUN:
    print("Dry run complete. Run with --force to execute deletions.")
    sys.exit(0)

# Step 2: Delete them (Only if not DRY_RUN)
print("Deleting hotels...")
deleted_count = 0
for h in hotels_to_delete:
    try:
        db.table("hotels").delete().eq("id", h["id"]).execute()
        deleted_count += 1
        print(f"  Deleted: {h['name']}")
    except Exception as e:
        print(f"  Failed to delete {h['name']}: {e}")

print()
print(f"Successfully cleaned up {deleted_count} orphaned hotels.")
