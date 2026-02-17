import os
import time
import requests
import re
from supabase import create_client

def normalize_name(name):
    """Remove common suffixes to improve search accuracy."""
    suffixes = ["Hotel", "Otel", "Pansiyon", "Resort", "Spa", "Apart", "Butik", "Konağı", "Konukevi"]
    clean_name = name
    for s in suffixes:
        clean_name = re.sub(rf"\b{s}\b", "", clean_name, flags=re.IGNORECASE)
    return clean_name.strip()

def backfill_balikesir_geo_v2():
    url = "https://ztwkdawfdfbgusskqbns.supabase.co"
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("Error: SUPABASE_SERVICE_ROLE_KEY not found.")
        return
    
    db = create_client(url, key)
    
    # 1. Fetch all Balikesir hotels from the directory
    res = db.table("hotel_directory").select("id, name, location, serp_api_id").ilike("location", "%Balikesir%").execute()
    directory = res.data or []
    
    print(f"Total Balikesir Directory Hotels: {len(directory)}")
    
    headers = {'User-Agent': 'HotelRateSentinel/1.0'}
    
    for h in directory:
        name = h["name"]
        location = h.get("location", "")
        clean_name = normalize_name(name)
        
        # Determine district for context
        district = ""
        known_districts = ["Ayvalık", "Edremit", "Akçay", "Altınoluk", "Güre", "Burhaniye", "Ören", "Gömeç", "Havran", "Karesi", "Altıeylül", "Bandırma", "Erdek", "Susurluk", "Manyas", "Balya", "İvrindi", "Savaştepe", "Bigadiç", "Sındırgı", "Dursunbey", "Marmara", "Küçükköy", "Cunda"]
        for d in known_districts:
            if d.lower() in location.lower() or d.lower() in name.lower():
                district = d
                break

        # Try multiple query variants
        queries = [
            f"{name}, {district}, Balikesir, Turkey" if district else f"{name}, Balikesir, Turkey",
            f"{clean_name}, {district}, Balikesir, Turkey" if district else f"{clean_name}, Balikesir, Turkey",
            f"{name}, Balikesir, Turkey",
            f"{name}, Turkey"
        ]
        
        lat, lng = None, None
        for q in queries:
            print(f"  Querying: {q}")
            try:
                resp = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": q, "format": "json", "limit": 1},
                    headers=headers
                )
                data = resp.json()
                if data:
                    lat = float(data[0]["lat"])
                    lng = float(data[0]["lon"])
                    break
            except Exception as e:
                print(f"    Search error: {e}")
            time.sleep(1) # Respect rate limits

        if lat and lng:
            print(f"  SUCCESS for {name}: {lat}, {lng}")
            
            # Use upsert or select+update/insert
            # To avoid conflict issues, we use a custom upsert logic
            try:
                # Check for existing hotel by name or serp_api_id
                existing = db.table("hotels").select("id").eq("name", name).execute()
                if not existing.data and h.get("serp_api_id"):
                    existing = db.table("hotels").select("id").eq("serp_api_id", h["serp_api_id"]).execute()
                
                payload = {
                    "name": name,
                    "location": location,
                    "latitude": lat,
                    "longitude": lng,
                    "serp_api_id": h.get("serp_api_id"),
                    "user_id": "00000000-0000-0000-0000-000000000000",
                    "updated_at": "now()"
                }
                
                if existing.data:
                    db.table("hotels").update(payload).eq("id", existing.data[0]["id"]).execute()
                    # print(f"    Updated existing entry.")
                else:
                    db.table("hotels").insert(payload).execute()
                    # print(f"    Inserted new entry.")
            except Exception as e:
                print(f"    Database error: {e}")
        else:
            print(f"  FAILED: No coordinates found for {name}")

if __name__ == "__main__":
    backfill_balikesir_geo_v2()
