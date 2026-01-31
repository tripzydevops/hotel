
import os
import asyncio
import re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Broad keywords that definitely shouldn't be in a city/location name
BAD_KEYWORDS = [
    "rooms", "hotel", "suites", "featuring", "plus", "offering", "breakfast", 
    "wi-fi", "spa", "pool", "stay", "view", "resort", "lodging", "unassuming",
    "polished", "refined", "relaxed", "simple", "casual", "informal", "upscale",
    "sophisticated", "modern", "traditional", "historic", "elegant", "property",
    "quarters", "accommodation", "shuttle", "airport", "center"
]

async def cleanup():
    print("Fetching all hotels...")
    res = supabase.table("hotel_directory").select("id, name, location").execute()
    hotels = res.data
    print(f"Total hotels in DB: {len(hotels)}")
    
    updates = 0
    to_update = []
    
    for hotel in hotels:
        loc = hotel['location']
        name = hotel['name']
        
        # Heuristic: description snippets usually Contain spaces and common descriptive words, or are quite long
        # Real locations are usually "City, Country" or "District, City, Country"
        
        is_bad = any(kw in loc.lower() for kw in BAD_KEYWORDS) or len(loc) > 40
        
        if is_bad:
            new_loc = "Turkey"
            # Try to infer from name if possible
            lower_name = name.lower()
            if any(x in lower_name for x in ["istanbul", "istanbul", "beyoğlu", "fatih", "sultanahmet"]):
                new_loc = "Istanbul, Turkey"
            elif any(x in lower_name for x in ["antalya", "belek", "kemer", "side", "alanya", "kas", "kalkan"]):
                new_loc = "Antalya, Turkey"
            elif any(x in lower_name for x in ["bodrum", "marmaris", "fethiye", "mugla", "mugla"]):
                new_loc = "Mugla, Turkey"
            elif any(x in lower_name for x in ["izmir", "cesme", "alacati"]):
                new_loc = "Izmir, Turkey"
            elif any(x in lower_name for x in ["nevşehir", "nevsehir", "goreme", "göreme", "urgup", "ürgüp", "cappadocia"]):
                new_loc = "Nevsehir, Turkey"
                
            to_update.append((hotel['id'], new_loc, name, loc))
            updates += 1

    print(f"Found {len(to_update)} hotels with suspect locations.")
    
    if not to_update:
        print("Nothing to clean.")
        return

    # Perform updates
    for h_id, n_loc, name, o_loc in to_update:
        try:
            # print(f"Fixing: [{name}] '{o_loc[:20]}...' -> '{n_loc}'")
            supabase.table("hotel_directory").update({"location": n_loc}).eq("id", h_id).execute()
        except Exception as e:
            print(f"Failed to update {h_id}: {e}")

    print(f"Cleanup complete. Successfully processed updates.")

if __name__ == "__main__":
    asyncio.run(cleanup())
