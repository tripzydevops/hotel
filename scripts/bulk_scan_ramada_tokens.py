
import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Add project root to path
# Assuming script is in /home/tripzydevops/hotel/scripts
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from backend.services.serpapi_client import serpapi_client

# Load environment
load_dotenv(".env.local")
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

HOTELS_TO_SCAN = [
    {"name": "Ramada by Wyndham Adıyaman", "location": "Adıyaman, Türkiye"},
    {"name": "Ramada by Wyndham Bursa Çekirge Thermal & Spa", "location": "Bursa, Türkiye"},
    {"name": "Ramada by Wyndham Bursa Nilüfer", "location": "Bursa, Türkiye"},
    {"name": "Ramada Residence by Wyndham Balıkesir", "location": "Balıkesir, Türkiye"},
    {"name": "Ramada Resort by Wyndham Kazdağları Thermal & Spa", "location": "Edremit/Kazdağları, Balıkesir, Türkiye"},
    {"name": "Ramada by Wyndham Cappadocia", "location": "Nevşehir, Türkiye"},
    {"name": "Ramada by Wyndham Diyarbakır", "location": "Diyarbakır, Türkiye"},
    {"name": "Ramada by Wyndham Dalaman", "location": "Dalaman, Muğla"},
    {"name": "Ramada by Wyndham Edirne", "location": "Edirne, Türkiye"},
    {"name": "Ramada by Wyndham Fethiye Ölüdeniz", "location": "Fethiye, Muğla, Türkiye"},
    {"name": "Ramada by Wyndham Gaziantep", "location": "Gaziantep, Türkiye"},
    {"name": "Ramada by Wyndham Giresun Piraziz", "location": "Giresun, Türkiye"},
    {"name": "Ramada by Wyndham Gümüşhane", "location": "Gümüşhane, Türkiye"},
    {"name": "Ramada by Wyndham Isparta", "location": "Isparta, Türkiye"},
    {"name": "Ramada by Wyndham İskenderun", "location": "İskenderun, Türkiye"},
    {"name": "Ramada by Wyndham İstanbul Alibeyköy", "location": "İstanbul, Türkiye"},
    {"name": "Ramada by Wyndham İstanbul Grand Bazaar", "location": "İstanbul, Türkiye"},
    {"name": "Ramada by Wyndham İstanbul Old City", "location": "İstanbul, Türkiye"},
    {"name": "Ramada by Wyndham İstanbul Sakarya Hendek", "location": "Sakarya, Türkiye"},
    {"name": "Ramada by Wyndham İstanbul Şile", "location": "İstanbul, Türkiye"},
    {"name": "Ramada by Wyndham Tekirdağ", "location": "Tekirdağ, Türkiye"},
    {"name": "Ramada by Wyndham Uşak", "location": "Uşak, Türkiye"},
    {"name": "Ramada by Wyndham Yalova", "location": "Yalova, Türkiye"},
    {"name": "Ramada by Wyndham Karapınar", "location": "Karapınar, Konya"},
    {"name": "Ramada by Wyndham Kemalpaşa İzmir (Hotel & Suites)", "location": "Kemalpaşa/İzmir, Türkiye"},
    {"name": "Ramada by Wyndham Kızkalesi Resort", "location": "Kızkalesi, Mersin/Akdeniz, Türkiye"},
    {"name": "Ramada by Wyndham Mersin", "location": "Mersin, Türkiye"},
    {"name": "Ramada by Wyndham Niğde", "location": "Niğde, Türkiye"},
    {"name": "Ramada Resort by Wyndham Pamukkale Thermal", "location": "Denizli/Pamukkale, Türkiye"},
    {"name": "Ramada Plaza by Wyndham Antalya", "location": "Antalya, Türkiye"},
    {"name": "Ramada Plaza by Wyndham İstanbul Ataköy", "location": "Ataköy, İstanbul, Türkiye"},
    {"name": "Ramada Plaza by Wyndham İstanbul Asia Airport", "location": "İstanbul, Türkiye"},
    {"name": "Ramada Plaza by Wyndham İstanbul City Centre", "location": "İstanbul, Türkiye"},
    {"name": "Ramada Plaza by Wyndham İstanbul Tekstilkent", "location": "İstanbul, Türkiye"},
    {"name": "Ramada Plaza by Wyndham İzmit", "location": "Kocaeli (İzmit), Türkiye"},
    {"name": "Ramada Plaza by Wyndham Konya", "location": "Konya, Türkiye"},
    {"name": "Ramada Plaza by Wyndham Mardin", "location": "Mardin, Türkiye"},
    {"name": "Ramada Plaza by Wyndham Rize", "location": "Rize, Türkiye"},
    {"name": "Ramada Plaza by Wyndham Samsun", "location": "Samsun, Türkiye"},
    {"name": "Ramada Plaza by Wyndham Trabzon", "location": "Trabzon, Türkiye"}
]

async def scan():
    print(f"--- Starting Bulk Scan for {len(HOTELS_TO_SCAN)} Ramada Properties ---")
    
    for entry in HOTELS_TO_SCAN:
        name = entry["name"]
        location = entry["location"]
        print(f"\n[SCAN] Searching for: {name} in {location}...")
        
        try:
            # Search with SerpApi
            results = await serpapi_client.search_hotels(f"{name} {location}", limit=5)
            
            if not results:
                print(f"[WARN] No results found for {name}")
                continue
                
            # Take the first match
            best_match = results[0]
            token = best_match.get("serp_api_id")
            
            if not token:
                print(f"[WARN] No property token found for {name}")
                continue
                
            print(f"[SUCCESS] Found Match: {best_match['name']} | Token: {token}")
            
            # Upsert into hotel_directory
            print(f"[SYNC] Upserting to 'hotel_directory'...")
            upsert_data = {
                "name": best_match["name"],
                "location": best_match.get("location"),
                "serp_api_id": token,
                "last_verified_at": datetime.now().isoformat()
            }
            
            # Use name,location for conflict based on test_add_hotel.py pattern
            supabase.table("hotel_directory").upsert(upsert_data, on_conflict="name,location").execute()
            print(f"[OK] Directory updated for {best_match['name']}")
            
        except Exception as e:
            print(f"[ERROR] Failed to process {name}: {e}")
            
        # Small delay to be polite to the API (though SerpApiClient handles its own throttling)
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(scan())
