import os
import sys
import asyncio
import traceback
from datetime import datetime, timezone
from typing import List, Dict, Any

# Ensure we can import from backend
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase
from backend.services.dashboard_service import get_dashboard_logic

async def run_audit():
    db = get_supabase(admin=True)
    if not db:
        print("CRITICAL: Could not initialize Supabase client.")
        return

    print(f"--- DATABASE AUDIT STARTED: {datetime.now(timezone.utc).isoformat()} ---")

    # 1. Fetch ALL user_hotels mappings
    try:
        res = db.table("user_hotels").select("*").execute()
        all_mappings = res.data or []
        print(f"Total Mapping Records found: {len(all_mappings)}")
    except Exception as e:
        print(f"ERROR: Failed to fetch user_hotels: {e}")
        return

    # 2. Group by user_id
    user_map = {}
    for m in all_mappings:
        uid = m.get("user_id")
        if uid not in user_map:
            user_map[uid] = []
        user_map[uid].append(m)

    unique_users = list(user_map.keys())
    print(f"Unique Users with mappings: {len(unique_users)}")

    # 3. Orphaned Record Check
    hotel_ids_in_mappings = list(set([m.get("hotel_id") for m in all_mappings if m.get("hotel_id")]))
    try:
        # Check hotels in batches
        all_existing_hotels = set()
        batch_size = 500
        for i in range(0, len(hotel_ids_in_mappings), batch_size):
            batch = hotel_ids_in_mappings[i:i+batch_size]
            h_res = db.table("hotels").select("id").in_("id", batch).execute()
            for h in (h_res.data or []):
                all_existing_hotels.add(str(h["id"]))
        
        orphaned = [m for m in all_mappings if str(m.get("hotel_id")) not in all_existing_hotels]
        if orphaned:
            print(f"WARNING: Found {len(orphaned)} orphaned mappings (hotel_id not in hotels table)!")
            for o in orphaned[:10]:
                print(f"  - User: {o.get('user_id')} -> Hotel ID: {o.get('hotel_id')}")
        else:
            print("SUCCESS: No orphaned mapping records detected.")
    except Exception as e:
        print(f"ERROR: Failed during orphaned check: {e}")

    # 4. Target Hotel Check
    users_without_target = []
    for uid, mappings in user_map.items():
        has_target = any(m.get("is_target") for m in mappings)
        if not has_target and mappings:
            users_without_target.append(uid)
    
    if users_without_target:
        print(f"INFO: {len(users_without_target)} users have no designated 'target' hotel.")
    
    # 5. Metadata Gap Check
    missing_metadata = []
    for m in all_mappings:
        if not m.get("pricing_dna") or not m.get("preferred_currency"):
            missing_metadata.append(m)
    
    if missing_metadata:
        print(f"WARNING: {len(missing_metadata)} mapping records have missing pricing_dna or preferred_currency.")

    # 6. Dashboard Simulation (Random Sample or All if count is low)
    print("\n--- SIMULATING DASHBOARD FOR ALL USERS ---")
    failures = []
    success_count = 0
    
    for uid in unique_users:
        try:
            # We use a dummy email for simulation
            # Note: get_dashboard_logic does internal auth checks, 
            # but since we are running as admin via get_supabase(admin=True) 
            # we should pass the user_id as current_user_id too.
            dashboard = await get_dashboard_logic(
                user_id=uid,
                current_user_id=uid, 
                current_user_email="audit@sim.local",
                db=db
            )
            
            if dashboard.get("error"):
                failures.append({"user_id": uid, "error": dashboard["error"]})
            else:
                success_count += 1
        except Exception as e:
            failures.append({"user_id": uid, "error": str(e)})

    print(f"Simulation Finished: {success_count} Successes, {len(failures)} Failures.")
    
    if failures:
        print("\nFAILURE DETAILS:")
        for f in failures:
            print(f"  - User {f['user_id']}: {f['error']}")

    print(f"\n--- AUDIT COMPLETED: {datetime.now(timezone.utc).isoformat()} ---")

if __name__ == "__main__":
    asyncio.run(run_audit())
