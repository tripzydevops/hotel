import json
import os
import asyncio
import httpx
from dotenv import load_dotenv
from postgrest import SyncPostgrestClient

# Load environment variables
load_dotenv(".env.local")

# DataForSEO Credentials
LOGIN = os.getenv("DATAFORSEO_LOGIN")
PASSWORD = os.getenv("DATAFORSEO_PASSWORD")
API_URL = "https://api.dataforseo.com/v3"

# InsForge Credentials
INSFORGE_URL = os.getenv("INSFORGE_GATEWAY", "https://tripzy.ams3.insforge.app")
INSFORGE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Local Paths
LOOKUP_FILE = "backend/data/location_lookup_tr.json"

async def live_location_search(location_query: str):
    """Fallback to live DataForSEO API if local lookup fails."""
    if not LOGIN or not PASSWORD:
        return None

    auth = (LOGIN, PASSWORD)
    async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
        # We search specifically in TR
        url = f"{API_URL}/business_data/google/locations?name={location_query}&country_code=TR"
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            
            data = resp.json()
            results = data.get("tasks", [])[0].get("result", [])
            
            # Filter for City or Province in Turkiye
            matches = [
                r for r in results 
                if "Turkiye" in r.get("location_name", "")
                and r.get("location_type") in ["City", "Province"]
            ]
            
            if matches:
                return {
                    "code": matches[0].get("location_code"),
                    "name": matches[0].get("location_name")
                }
        except Exception as e:
            print(f"⚠️ Error in live search for '{location_query}': {e}")
            
    return None

async def enrich_locations():
    # 1. Load Local Lookup
    try:
        with open(LOOKUP_FILE, "r") as f:
            lookup = json.load(f)
    except FileNotFoundError:
        print(f"❌ Lookup file not found: {LOOKUP_FILE}")
        return

    # 2. Initialize InsForge Client
    # Note: Using httpx for direct Postgres/PostgREST updates is often cleaner in scripts
    headers = {"apikey": INSFORGE_ANON_KEY, "Authorization": f"Bearer {INSFORGE_ANON_KEY}"}
    
    async with httpx.AsyncClient(base_url=INSFORGE_URL, headers=headers) as client:
        # Fetch all hotels that need location enrichment
        print("🔍 Fetching hotels with missing location codes...")
        resp = await client.get("/rest/v1/hotel_directory?select=id,location&location_code=is.null")
        if resp.status_code != 200:
            print(f"❌ Failed to fetch hotels: {resp.text}")
            return
        
        hotels = resp.json()
        print(f"📊 Found {len(hotels)} hotels to process.")

        count = 0
        for hotel in hotels:
            hotel_id = hotel["id"]
            raw_loc = hotel.get("location", "")
            if not raw_loc:
                continue

            # Parse location string (e.g., "Istanbul, Turkey" -> "istanbul")
            city_part = raw_loc.split(",")[0].strip().lower()
            
            match = lookup.get(city_part)
            source = "local"
            
            if not match:
                # Try live search fallback
                print(f"🌐 No local match for '{city_part}'. Trying live search...")
                match = await live_location_search(city_part)
                source = "live"

            if match:
                code = match.get("code")
                resolved_name = match.get("name") if source == "live" else match.get("full_name")
                
                # Update Database
                update_resp = await client.patch(
                    f"/rest/v1/hotel_directory?id=eq.{hotel_id}",
                    json={
                        "location_code": code,
                        "resolved_location_name": resolved_name,
                        "location_verified": True
                    }
                )
                
                if update_resp.status_code in [200, 201, 204]:
                    count += 1
                    if count % 10 == 0:
                        print(f"✅ Processed {count}/{len(hotels)} hotels... (Last: {resolved_name} via {source})")
                else:
                    print(f"❌ Failed to update hotel {hotel_id}: {update_resp.text}")
            else:
                print(f"❓ Could not resolve location: '{raw_loc}'")

        print(f"\n✨ Enrichment complete! Successfully updated {count} hotels.")

if __name__ == "__main__":
    asyncio.run(enrich_locations())
