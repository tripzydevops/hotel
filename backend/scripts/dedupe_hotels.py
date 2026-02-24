import os
import asyncio
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Setup Supabase
load_dotenv()
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def dedupe_hotels():
    print("--- Starting Hotel De-duplication Process ---")
    
    # 1. Fetch all hotels
    res = supabase.table("hotels").select("*").execute()
    hotels = res.data or []
    print(f"Fetched {len(hotels)} total hotels (including potentially deleted).")
    
    ramadas = [h for h in hotels if "Ramada" in (h.get("name") or "")]
    print(f"Ramadas in DB: {len(ramadas)}")
    for r in ramadas:
        print(f"  ID: {r['id']}, User: {r['user_id']}, SERP: {r['serp_api_id']}, DeletedAt: {r['deleted_at']}, Target: {r['is_target_hotel']}")

    # 2. Group by user_id and serp_api_id
    groups = {}
    for h in hotels:
        if h.get("deleted_at"): continue # Skip deleted
        sid = h.get("serp_api_id")
        uid = h.get("user_id")
        if not sid or not uid: continue
        
        key = (uid, sid)
        if key not in groups:
            groups[key] = []
        groups[key].append(h)
    
    print(f"Grouped into {len(groups)} unique (user, serp) pairs.")
    
    # 3. Process groups with duplicates
    for (uid, sid), h_list in groups.items():
        if len(h_list) < 2:
            continue
            
        print(f"\nFound {len(h_list)} duplicates for User {uid}, SERP {sid}")
        
        # Determine Primary: 
        # Priority 1: is_target_hotel
        # Priority 2: updated_at
        h_list.sort(key=lambda x: (bool(x.get("is_target_hotel")), x.get("updated_at", "")), reverse=True)
        
        primary = h_list[0]
        secondaries = h_list[1:]
        
        print(f"PRIMARY: {primary['name']} ({primary['id']})")
        
        for sec in secondaries:
            print(f"SECONDARY TO BE MERGED: {sec['id']}")
            
            # Step A: Migrate price_logs
            logs_res = supabase.table("price_logs").select("id").eq("hotel_id", sec["id"]).execute()
            logs = logs_res.data or []
            
            if logs:
                print(f"  Moving {len(logs)} logs to primary...")
                for log in logs:
                    supabase.table("price_logs").update({"hotel_id": primary["id"]}).eq("id", log["id"]).execute()
            
            # Step B: Mark secondary as deleted
            print(f"  Marking secondary {sec['id']} as deleted...")
            supabase.table("hotels").update({"deleted_at": datetime.utcnow().isoformat()}).eq("id", sec["id"]).execute()
            
    print("\n--- De-duplication Complete ---")

if __name__ == "__main__":
    asyncio.run(dedupe_hotels())
