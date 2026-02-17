
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta

# Load credentials from .env.local
load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found in env")
    exit(1)

supabase: Client = create_client(url, key)

async def diag():
    print("--- Diagnostic: Missing Rates for Ramada ---")
    
    # 1. Find the target hotel
    hotel_res = supabase.table("hotels").select("*").ilike("name", "%Ramada%").execute()
    if not hotel_res.data:
        print("Ramada hotel not found")
        return
    
    target_hotel = hotel_res.data[0]
    hid = target_hotel["id"]
    print(f"Hotel: {target_hotel['name']} (ID: {hid})")

    # 2. Check price_logs for recent dates
    start_date = "2026-02-12"
    end_date = "2026-02-25"
    
    # We check logs recorded recently or with check-in dates in the range
    logs_res = supabase.table("price_logs") \
        .select("*") \
        .eq("hotel_id", hid) \
        .order("recorded_at", desc=True) \
        .limit(20) \
        .execute()
    
    if not logs_res.data:
        print("No price logs found for this hotel")
    else:
        print(f"Found {len(logs_res.data)} recently recorded logs")
        for log in logs_res.data:
            print(f"\nRecorded At: {log['recorded_at']}")
            print(f"Check-in Date: {log.get('check_in_date')}")
            print(f"Price: {log['price']}")
            r_types = log.get("room_types") or []
            print(f"Room Types Count: {len(r_types)}")
            if r_types:
                for i, rt in enumerate(r_types[:5]): # Show first 5
                    print(f"  [{i}] Name: {rt.get('name')}, Price: {rt.get('price')}, Canonical: {rt.get('canonical_name')}, Code: {rt.get('canonical_code')}")

    # 3. Check room_type_catalog for this hotel
    catalog_res = supabase.table("room_type_catalog") \
        .select("original_name, normalized_name") \
        .eq("hotel_id", hid) \
        .execute()
    
    print(f"\n--- Room Type Catalog for Hotel {hid} ---")
    if not catalog_res.data:
        print("No catalog entries found")
    else:
        for entry in catalog_res.data:
            print(f"Original: {entry['original_name']}, Normalized: {entry['normalized_name']}")

    # 4. Check global room matching RPC
    # This simulates what analysis_service does
    try:
        # Get embedding for "Standard"
        search_rt = "Standard"
        cat_match = supabase.table("room_type_catalog").select("embedding") \
            .ilike("normalized_name", f"%{search_rt}%").limit(1).execute()
        
        if cat_match.data:
            emb = cat_match.data[0]["embedding"]
            matches = supabase.rpc("match_room_types", {
                "query_embedding": emb,
                "match_threshold": 0.82,
                "match_count": 50
            }).execute()
            
            print(f"\n--- RPC Matches for '{search_rt}' ---")
            found_for_hotel = False
            for m in (matches.data or []):
                if str(m["hotel_id"]) == str(hid):
                    print(f"Match for Ramada: {m['original_name']} (Sim: {m.get('similarity')})")
                    found_for_hotel = True
            if not found_for_hotel:
                print("No RPC matches found for Ramada for 'Standard'")
    except Exception as e:
        print(f"RPC Match Check failed: {e}")

if __name__ == "__main__":
    asyncio.run(diag())
