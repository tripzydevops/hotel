import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv(".env")
load_dotenv(".env.local", override=True)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def diagnose():
    print("Database Diagnostic Tool")
    print(f"URL: {SUPABASE_URL}")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("\n--- ALL HOTELS ---")
    hotels = supabase.table("hotels").select("id, name, serp_api_id, user_id, is_target_hotel").execute()
    
    # Sort for better visibility
    data = sorted(hotels.data, key=lambda x: (x['user_id'] or 'None', x['name']))
    
    for h in data:
        target_marker = "[TARGET]" if h['is_target_hotel'] else "        "
        id_marker = f"(ID: {h['serp_api_id'][:10]}...)" if h['serp_api_id'] else "(NO ID)     "
        print(f"{target_marker} User: {h['user_id']} | {id_marker} | Name: {h['name']} | UUID: {h['id']}")

    print("\n--- ANALYSIS ---")
    # Identify orphans (target without ID)
    orphans = [h for h in data if h['is_target_hotel'] and not h['serp_api_id']]
    if orphans:
        print(f"CRITICAL: Found {len(orphans)} target hotels without SerpApi IDs!")
        for o in orphans:
            print(f"  - {o['name']} (Owner: {o['user_id']})")
    else:
        print("SUCCESS: All target hotels have SerpApi IDs.")

    # Identify duplicates
    names_by_user = {}
    for h in data:
        key = (h['user_id'], h['name'])
        if key not in names_by_user:
            names_by_user[key] = []
        names_by_user[key].append(h['id'])
    
    duplicates = {k: v for k, v in names_by_user.items() if len(v) > 1}
    if duplicates:
        print(f"WARNING: Found {len(duplicates)} duplicate records!")
        for (uid, name), ids in duplicates.items():
            print(f"  - {name} (Owner: {uid}): {len(ids)} copies")
    else:
        print("SUCCESS: No duplicate records found.")

if __name__ == "__main__":
    diagnose()
