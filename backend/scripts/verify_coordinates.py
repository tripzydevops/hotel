import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

from supabase import create_client

def verify():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    db = create_client(url, key)

    print("Checking for populated coordinates...")
    res = db.table("hotels").select("name, latitude, longitude").not_.is_("latitude", "null").execute()
    
    populated = res.data or []
    print(f"Found {len(populated)} hotels with coordinates.")
    for h in populated:
        print(f" - {h['name']}: {h['latitude']}, {h['longitude']}")

if __name__ == "__main__":
    verify()
