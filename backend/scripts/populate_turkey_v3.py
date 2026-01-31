
import os
import asyncio
import sys
import io
from typing import List
from dotenv import load_dotenv

# Force UTF-8 output
# sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add project root directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.services.serpapi_client import serpapi_client
from supabase import create_client

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Extremely detailed prime tourist locations (posh districts, resorts, hidden gems)
PRIME_TARGETS = [
    # Istanbul Deep Dive
    "Sultanahmet", "Beyoglu", "Galata", "Besiktas", "Nisantasi", "Karakoy", "Sariyer", "Ortakoy", "Bebek Istanbul", "Kadikoy", "Moda Istanbul",
    # Bodrum Posh Districts
    "Yalikavak", "Turkbuku", "Torba", "Gumbet", "Bitez", "Ortakent", "Gumusluk", "Bodrum Center", "Turgutreis",
    # Antalya Ultra Prime
    "Lara Antalya", "Kundu", "Konyaalti", "Belek Golf", "Side Old Town", "Kemer Center", "Olympos", "Cirali", "Finike",
    # Fethiye & Surroundings
    "Oludeniz", "Calis Beach", "Faralya", "Kayakoy", "Gocek Marinas",
    # Kas & Kalkan
    "Kas Center", "Kalkan Bay", "Patara", "Meis View Kas",
    # Marmaris Region
    "Icmeler", "Turunc", "Selimiye Marmaris", "Bozburun", "Hisaronu Marmaris",
    # Izmir & Aegean Prime
    "Alacati Center", "Cesme Marina", "Dalyan Cesme", "Pasa Limani", "Urla", "Sigacik", "Foca Old Town", "Ayvalik Center", "Cunda Island",
    # Canakkale & Islands
    "Assos", "Bozcaada", "Gokceada", "Canakkale Center",
    # Cappadocia Districts
    "Goreme", "Uchisar", "Urgup", "Avanos", "Ortahisar", "Mustafapasa",
    # Cultural & Nature Gems
    "Pamukkale", "Hierapolis", "Sirince", "Ephesus Selcuk", "Afrodisias", "Mardin Old Town", "Halfeti",
    # Black Sea Prime
    "Ayder Plateau", "Uzungol", "Firtina Valley", "Trabzon Center", "Sumela",
    # Winter Luxury
    "Uludag Hotels", "Kartalkaya", "Palandoken Hotels", "Erciyes Hotels", "Sapanca Lake", "Abant Lake"
]

# All other provinces
PROVINCES = [
    "Adana", "Adiyaman", "Afyonkarahisar", "Agri", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
    "Aydin", "Balikesir", "Bartin", "Batman", "Bayburt", "Bilecik", "Bingol", "Bitlis", "Bolu", "Burdur",
    "Bursa", "Canakkale", "Cankiri", "Corum", "Denizli", "Diyarbakir", "Duzce", "Edirne", "Elazig", "Erzincan",
    "Erzurum", "Eskisehir", "Gaziantep", "Giresun", "Gumushane", "Hakkari", "Hatay", "Igdir", "Isparta", "Istanbul",
    "Izmir", "Kahramanmaras", "Karabuk", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kirikkale", "Kirklareli",
    "Kirsehir", "Kocaeli", "Konya", "Kutahya", "Malatya", "Manisa", "Mardin", "Mersin", "Mugla", "Mus",
    "Nevsehir", "Nigde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Sanliurfa", "Siirt", "Sinop",
    "Sirnak", "Sivas", "Tekirdag", "Tokat", "Trabzon", "Tunceli", "Usak", "Van", "Yalova", "Yozgat", "Zonguldak"
]

async def process_hotels(results, city_name):
    new_hotels = 0
    updated_hotels = 0
    
    for hotel in results:
        name = hotel["name"]
        serp_api_id = hotel["serp_api_id"]
        location = hotel["location"]
        
        if not serp_api_id: continue
        
        # If location is Unknown or very short, use the city name
        if location == "Unknown" or len(location) < 5:
            location = f"{city_name}, Turkey"
        
        hotel_data = {
            "name": name,
            "location": location,
            "serp_api_id": serp_api_id,
            "stars": hotel.get("stars"),
            "rating": hotel.get("rating"),
            "description": hotel.get("description"),
            "amenities": hotel.get("amenities"),
            "images": hotel.get("images")
        }

        try:
            # Check by serp_api_id or name
            existing = supabase.table("hotel_directory").select("id").eq("serp_api_id", serp_api_id).execute()
            if not existing.data:
                existing = supabase.table("hotel_directory").select("id").eq("name", name).execute()
            
            if existing.data:
                supabase.table("hotel_directory").update(hotel_data).eq("id", existing.data[0]['id']).execute()
                updated_hotels += 1
            else:
                supabase.table("hotel_directory").insert(hotel_data).execute()
                new_hotels += 1
                print(f"  [NEW] {name}")
        except Exception as e:
            print(f"  [ERROR] {name}: {e}")
            
    return new_hotels, updated_hotels

async def scan_location(location, star_rating=None, query_prefix="Hotels in"):
    query = f"{query_prefix} {location}, Turkey"
    if star_rating:
        query = f"{star_rating} star hotels in {location}, Turkey"
    
    print(f"Scanning: {query}...")
    try:
        results = await serpapi_client.search_hotels(query, limit=50)
        new_c, upd_c = await process_hotels(results, location)
        print(f" -> Result: {len(results)} found, {new_c} new, {upd_c} updated.")
        return 1
    except Exception as e:
        print(f" -> FAILED: {e}")
        return 0

async def main():
    import random
    unique_locations = list(set(PRIME_TARGETS + PROVINCES))
    # Randomize to avoid getting stuck on one region if interrupted
    random.shuffle(unique_locations)
    
    print(f"Starting Premium Population Scan")
    print(f"Total target locations: {len(unique_locations)}")
    print("=" * 60)
    
    total_calls = 0
    
    # Phase 1: ULTRA PRIME DEEP DIVE (4 and 5 stars)
    print("\n--- Phase 1: Ultra Prime Deep Dive ---")
    ULTRA_PRIME = ["Istanbul", "Antalya", "Bodrum", "Alacati", "Belek", "Cappadocia", "Kalkan", "Kas", "Fethiye", "Marmaris"]
    for loc in ULTRA_PRIME:
        for stars in [4, 5]:
            total_calls += await scan_location(loc, stars)
            await asyncio.sleep(0.5)

    # Phase 2: PRIME DISTRICTS & GEMS
    print("\n--- Phase 2: Prime Districts & Hidden Gems ---")
    for loc in PRIME_TARGETS:
        total_calls += await scan_location(loc)
        await asyncio.sleep(0.5)
        
    # Phase 3: BROAD SCAN (Remaining Provinces)
    print("\n--- Phase 3: Broad Provincial Scan ---")
    for loc in PROVINCES:
        total_calls += await scan_location(loc)
        await asyncio.sleep(0.5)
        
    print(f"\nDone. Approx API calls: {total_calls}")

if __name__ == "__main__":
    asyncio.run(main())
