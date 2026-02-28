
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env")
load_dotenv(".env.local", override=True)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def check_mismatches():
    print("--- Searching for Token Mismatches ---")
    
    # Get all active hotels
    hotels_res = supabase.table("hotels").select("id, name, serp_api_id, location").is_("deleted_at", "null").execute()
    hotels = hotels_res.data or []
    
    print(f"Found {len(hotels)} active hotels.")
    
    mismatches = []
    
    for h in hotels:
        # Search directory by name and location
        # Using exact name and location for now
        dir_res = supabase.table("hotel_directory").select("serp_api_id")\
            .eq("name", h["name"])\
            .eq("location", h["location"])\
            .execute()
        
        if dir_res.data:
            dir_token = dir_res.data[0].get("serp_api_id")
            hotel_token = h.get("serp_api_id")
            
            if dir_token != hotel_token:
                mismatches.append({
                    "name": h["name"],
                    "hotel_token": hotel_token,
                    "dir_token": dir_token,
                    "id": h["id"]
                })
        else:
            # Try just name
            dir_res = supabase.table("hotel_directory").select("serp_api_id")\
                .eq("name", h["name"])\
                .execute()
            if dir_res.data:
                dir_token = dir_res.data[0].get("serp_api_id")
                hotel_token = h.get("serp_api_id")
                if dir_token != hotel_token:
                    mismatches.append({
                        "name": h["name"],
                        "note": "matched by name only",
                        "hotel_token": hotel_token,
                        "dir_token": dir_token,
                        "id": h["id"]
                    })

    if mismatches:
        print(f"\nFound {len(mismatches)} mismatches:")
        for m in mismatches:
            print(f"Hotel: {m['name']} ({m.get('note', 'full match')})")
            print(f"  Hotel Token: {m['hotel_token']}")
            print(f"  Dir Token:   {m['dir_token']}")
            print(f"  Hotel ID:    {m['id']}")
    else:
        print("\nNo mismatches found.")

if __name__ == "__main__":
    asyncio.run(check_mismatches())
