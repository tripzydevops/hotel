import os
from dotenv import load_dotenv
from supabase import create_client

# Load from root .env if possible, or backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials in environment.")
    exit(1)

supabase = create_client(url, key)

def sync_hotels():
    print("Fetching existing hotels...")
    # Fetch all hotels
    response = supabase.table("hotels").select("name, location, serp_api_id").execute()
    hotels = response.data
    
    if not hotels:
        print("No hotels found to sync.")
        return

    print(f"Found {len(hotels)} hotels. Syncing to directory...")
    
    count = 0
    for hotel in hotels:
        try:
            name = hotel.get("name", "").strip().title()
            location = (hotel.get("location") or "").strip().title()
            
            if not name:
                continue
                
            data = {
                "name": name,
                "location": location if location else None,
                "serp_api_id": hotel.get("serp_api_id")
            }
            
            # Upsert into directory (ignore duplicates)
            supabase.table("hotel_directory").upsert(
                data, 
                on_conflict="name,location"
            ).execute()
            count += 1
        except Exception as e:
            print(f"Skipping {hotel.get('name')}: {e}")

    print(f"Successfully synced {count} hotels to the directory.")

if __name__ == "__main__":
    sync_hotels()
