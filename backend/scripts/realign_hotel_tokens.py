
import asyncio
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Ensure backend module is resolvable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(".env")
load_dotenv(".env.local", override=True)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def realign_tokens():
    print("--- Starting Token Re-alignment ---")
    
    # 1. Fetch all active hotels
    hotels_res = supabase.table("hotels").select("id, name, serp_api_id, location").is_("deleted_at", "null").execute()
    hotels = hotels_res.data or []
    print(f"Checking {len(hotels)} active hotels...")
    
    updated_count = 0
    mismatch_count = 0
    
    for h in hotels:
        # Search directory for a matching hotel
        # Strategy: Match by exact name and location first
        dir_res = supabase.table("hotel_directory").select("serp_api_id, name")\
            .eq("name", h["name"])\
            .eq("location", h["location"])\
            .execute()
        
        if not dir_res.data:
            # Fallback: Match by name only (case-insensitive fuzzy)
            dir_res = supabase.table("hotel_directory").select("serp_api_id, name")\
                .ilike("name", h["name"])\
                .execute()
        
        if dir_res.data:
            dir_token = dir_res.data[0].get("serp_api_id")
            hotel_token = h.get("serp_api_id")
            
            if dir_token and dir_token != hotel_token:
                mismatch_count += 1
                print(f"Mismatch found for '{h['name']}':")
                print(f"  Current: {hotel_token}")
                print(f"  Correct: {dir_token}")
                
                # Perform update
                try:
                    supabase.table("hotels").update({"serp_api_id": dir_token}).eq("id", h["id"]).execute()
                    print(f"  Successfully updated '{h['name']}'.")
                    updated_count += 1
                except Exception as e:
                    print(f"  Failed to update '{h['name']}': {e}")
        else:
            print(f"No directory entry found for '{h['name']}' ({h['location']}).")

    print(f"\nRe-alignment complete.")
    print(f"Total mismatches found: {mismatch_count}")
    print(f"Total updates performed: {updated_count}")

if __name__ == "__main__":
    asyncio.run(realign_tokens())
