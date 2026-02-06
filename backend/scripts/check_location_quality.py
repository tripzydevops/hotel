import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

load_dotenv(".env.local", override=True)

from supabase import create_client

def check_locations():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials missing (SERVICE_ROLE_KEY required).")
        return

    print("Connecting to Supabase...")
    db = create_client(url, key)

    print("Checking 'hotels' location quality...")
    try:
        res = db.table("hotels").select("name, location, id").limit(10).execute()
        if res.data:
            print(f"Found {len(res.data)} hotels. Data Sample:")
            for h in res.data:
                print(f" - {h['name']}: '{h.get('location')}'")
        else:
            print("No hotels found.")

    except Exception as e:
        print(f"Error checking hotels: {e}")

if __name__ == "__main__":
    check_locations()
