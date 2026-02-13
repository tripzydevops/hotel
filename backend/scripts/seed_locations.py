
import os
import asyncio
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())

load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

TURKISH_CITIES = [
    "Adana", "Adiyaman", "Afyonkarahisar", "Agri", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
    "Aydin", "Balikesir", "Bartin", "Batman", "Bayburt", "Bilecik", "Bingol", "Bitlis", "Bolu", "Burdur",
    "Bursa", "Canakkale", "Cankiri", "Corum", "Denizli", "Diyarbakir", "Duzce", "Edirne", "Elazig", "Erzincan",
    "Erzurum", "Eskisehir", "Gaziantep", "Giresun", "Gumushane", "Hakkari", "Hatay", "Igdir", "Isparta", "Istanbul",
    "Izmir", "Kahramanmaras", "Karabuk", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kirikkale", "Kirklareli",
    "Kirsehir", "Kocaeli", "Konya", "Kutahya", "Malatya", "Manisa", "Mardin", "Mersin", "Mugla", "Mus",
    "Nevsehir", "Nigde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Sanliurfa", "Siirt", "Sinop",
    "Sirnak", "Sivas", "Tekirdag", "Tokat", "Trabzon", "Tunceli", "Usak", "Van", "Yalova", "Yozgat", "Zonguldak"
]

async def seed_locations():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    db = create_client(url, key)

    try:
        # 1. Fix Typo "Balikeesir" -> "Balikesir" in location_registry
        print("1. Fixing typo 'Balikeesir' in location_registry...")
        db.table("location_registry").delete().eq("city", "Balikeesir").execute()
        
        # Also need to fix it in hotels table if strictly needed, but let's focus on registry first as that feeds dropdown
        # The hotels table strings are "Balikeesir" inside raw text. We can update them:
        print("   Updating hotels table typos...")
        db.table("hotels").update({"location": "Balikesir"}).eq("location", "Balikeesir").execute()


        # 2. Seed all 81 provinces
        print(f"2. Seeding {len(TURKISH_CITIES)} Turkish cities...")
        
        # Fetch existing to avoid blindly overwriting counts (though we used upsert before)
        # We will use upsert safely.
        
        entries = []
        for city in TURKISH_CITIES:
            entries.append({
                "country": "Turkey",
                "city": city,
                "district": "",
                "last_updated_at": "2024-01-30T12:00:00Z"
            })
            
        # Supabase upsert in batches? 81 is small enough for one go usually.
        # But let's verify if upsert works without conflict. 
        # The unique constraint is country, city, district.
        
        res = db.table("location_registry").upsert(entries, on_conflict="country, city, district").execute()
        print(f"   Seeding complete. Upserted {len(res.data) if res.data else 'many'} rows.")

        print("✅ DONE.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(seed_locations())
