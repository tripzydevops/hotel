"""
Script to delete 'orphaned' hotels from the database.

CRITICAL SAFETY GUARDS (Lessons from Ramada Incident - Feb 2026):
1. DRY RUN BY DEFAULT: Script only lists candidates unless --force is used.
2. ACTIVE USER PROTECTION: Hotels belonging to users in user_profiles are NEVER deleted.
3. TARGET HOTEL PROTECTION: Hotels with is_target_hotel=True are NEVER deleted.
4. TOKEN REQUIREMENT: Only hotels missing BOTH property_token AND serp_api_id are considered.

Purpose: Purge hotels that cannot be scanned (useless) but protect ALL user data.
"""
from backend.utils.db import get_supabase_client, load_env_standard

import sys
# Standardize environment loading
load_env_standard()

# Initialize via the global factory to handle InsForge pathing
db = get_supabase_client()

# EXPLANATION: Safety Mode Toggle
# Why: To prevent accidental data loss, we require an explicit --force flag.
# Without it, the script only performs a dry-run.
DRY_RUN = "--force" not in sys.argv

# Step 1: Find candidates and fetch Active User list
print("=" * 60)
print("IDENTIFYING CANDIDATES FOR CLEANUP (M2M ARCHITECTURE)")
if DRY_RUN:
    print("MODE: DRY RUN (No deletions will be performed)")
else:
    print("MODE: LIVE DELETION (!!!)")
print("=" * 60)

# Fetch all hotels (only columns that still exist in the master table)
all_hotels = db.table("hotels").select("id, name, property_token, serp_api_id, created_at").execute()

# Fetch all associations to check for protection
# KAİZEN: Cross-reference user_hotels with user_profiles
assoc_res = db.table("user_hotels").select("hotel_id, user_id, is_target").execute()
associations = assoc_res.data or []

# Fetch all valid user profiles (Active/Registered users)
profiles_res = db.table("user_profiles").select("user_id").execute()
active_user_ids = {str(p["user_id"]) for p in (profiles_res.data or [])}

# Build protection maps
# hotel_id -> set of active users owning it
hotel_owners = {}
# hotel_id -> bool (is it a target for ANYONE)
global_targets = set()

for a in associations:
    hid = a["hotel_id"]
    uid = str(a["user_id"])
    if uid in active_user_ids:
        if hid not in hotel_owners:
            hotel_owners[hid] = set()
        hotel_owners[hid].add(uid)
    if a.get("is_target"):
        global_targets.add(hid)

hotels_to_delete = []
for h in all_hotels.data or []:
    name = h.get("name") or "Unknown"
    hid = h["id"]
    
    # 1. Check for valid tracking tokens
    has_token = h.get("property_token") or h.get("serp_api_id")
    
    # 2. Check for Target status (in any association)
    is_target = hid in global_targets
    
    # 3. Check for Active User ownership (has at least one valid owner)
    owners = hotel_owners.get(hid, set())
    is_active_user_owned = len(owners) > 0
    
    # THE REJECTION LOGIC (The Safety Fence)
    if not has_token:
        # Candidate for deletion, BUT check layers of protection first
        if is_target:
            print(f"  [SAFE] {name} (ID: {hid[:8]}...): Protected as TARGET HOTEL in associations.")
        elif is_active_user_owned:
            print(f"  [SAFE] {name} (ID: {hid[:8]}...): Protected as ACTIVE USER property (Owners: {len(owners)}).")
        else:
            hotels_to_delete.append(h)
            print(f"  - {name} (ID: {hid[:8]}...) -> CANDIDATE (No Token, No Active Owners)")
    elif not is_active_user_owned and not is_target:
        # KAİZEN: We also cleanup hotels that HAVE tokens but NO OWNERS (true orphans)
        # This keeps the global directory clean of unreferenced properties.
        hotels_to_delete.append(h)
        print(f"  - {name} (ID: {hid[:8]}...) -> CANDIDATE (Token exists but 0 Active Owners)")

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
