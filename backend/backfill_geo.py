import os
import time
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env vars
load_dotenv(".env.local")

# Initialize Supabase
url: str = str(os.environ.get("NEXT_PUBLIC_SUPABASE_URL"))
key: str = str(os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

if not url or not key or url == "None" or key == "None":
    print("Error: Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.")
    exit(1)

supabase: Client = create_client(url, key)

def get_coordinates(query: str):
    """Fetch coordinates from Nominatim (OpenStreetMap)."""
    try:
        base_url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": query,
            "format": "json",
            "limit": 1
        }
        headers = {
            "User-Agent": "HotelRateSentinel/1.0 (tripzydevops@gmail.com)"
        }
        response = requests.get(base_url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
        return None, None
    except Exception as e:
        print(f"  [Error] Geocoding failed for '{query}': {e}")
        return None, None

def backfill_hotels():
    print("Starting Geolocation Backfill...")
    
    # Fetch all hotels (limit to 100 for safety in this run)
    response = supabase.table("hotels").select("id, name, location, latitude, longitude").execute()
    hotels = response.data
    
    print(f"Found {len(hotels)} hotels.")
    
    updated_count = 0
    
    for hotel in hotels:
        # Check if needs update (missing lat/long)
        if hotel.get("latitude") and hotel.get("longitude"):
            continue
            
        hotel_id = hotel["id"]
        name = hotel["name"]
        location = hotel.get("location") or ""
        
        # Construct query: Try Name + Location first, then just Location
        query = f"{name}, {location}"
        print(f"Processing: {query}...")
        
        lat, lng = get_coordinates(query)
        
        # Fallback to just city/location if specific hotel not found
        if not lat and location:
            print(f"  Not found. Retrying with location only: {location}")
            lat, lng = get_coordinates(location)
            
        if lat and lng:
            print(f"  -> Found! ({lat}, {lng})")
            
            # Update DB
            supabase.table("hotels").update({
                "latitude": lat,
                "longitude": lng
            }).eq("id", hotel_id).execute()
            
            updated_count += 1
        else:
            print("  -> Could not resolve coordinates.")
            
        # Respect API Rate Limit (1 request per second)
        time.sleep(1.1)
        
    print(f"\nBackfill Complete. Updated {updated_count} hotels.")

if __name__ == "__main__":
    backfill_hotels()
