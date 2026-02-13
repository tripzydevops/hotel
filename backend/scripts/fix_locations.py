
import os
# ruff: noqa
import asyncio
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())

# Load envs
load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

async def fix_locations():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("❌ Supabase credentials missing!")
        return

    db = create_client(url, key)
    
    try:
        print("1. Cleaning invalid location_registry entries...")
        # Delete entries where country is a currency
        currencies = ["USD", "EUR", "TRY", "GBP"]
        for curr in currencies:
            db.table("location_registry").delete().eq("country", curr).execute()
        
        print("2. Repopulating from hotels table...")
        res_hotels = db.table("hotels").select("location").execute()
        hotels = res_hotels.data or []
        
        seen = set()
        
        for h in hotels:
            raw_loc = h.get("location")
            if not raw_loc:
                continue
                
            # Naive parsing logic
            parts = [p.strip() for p in raw_loc.split(",")]
            
            city = ""
            country = "Turkey" # Default
            
            if len(parts) == 1:
                city = parts[0]
            elif len(parts) >= 2:
                city = parts[0]
                country = parts[-1] 
                # If country is actually a currency (due to bad data upstream), fix it
                if country in currencies:
                    country = "Turkey"
            
            key = f"{country}-{city}"
            if key in seen:
                continue
            seen.add(key)
            
            print(f"Adding: {city}, {country}")
            
            # Upsert
            db.table("location_registry").upsert({
                "country": country,
                "city": city,
                "district": "",
                "last_updated_at": "2024-01-30T12:00:00Z"
            }).execute()

        print("✅ Location registry fixed.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_locations())
