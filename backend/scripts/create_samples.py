import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

load_dotenv(".env.local", override=True)

from backend.main import get_supabase

async def create_samples():
    db = get_supabase()
    user_id = "d33fc277-7006-468f-91b6-8cc7897fd910"

    hotels = [
        {"user_id": user_id, "name": "Rixos Pera Istanbul", "location": "Istanbul, Turkey", "is_target_hotel": True},
        {"user_id": user_id, "name": "Swissotel The Bosphorus", "location": "Istanbul, Turkey", "is_target_hotel": False},
        {"user_id": user_id, "name": "Hilton Istanbul Bomonti", "location": "Istanbul, Turkey", "is_target_hotel": False}
    ]

    print("Creating sample hotels...")
    for h in hotels:
        try:
            res = db.table("hotels").insert(h).execute()
            print(f"✅ Created: {h['name']}")
        except Exception as e:
            print(f"⚠️ Error creating {h['name']}: {e}")

if __name__ == "__main__":
    asyncio.run(create_samples())
