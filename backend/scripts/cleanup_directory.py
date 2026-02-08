"""
Script to list mock hotels in the hotel_directory table.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
# Load from project root .env.local
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env.local")
load_dotenv(env_path)

from supabase import create_client

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing Supabase credentials")
    sys.exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)

# Set stdout to utf-8 just in case
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())

print("=" * 80)
print(f"{'HOTEL NAME':<40} | {'SERPAPI ID':<25} | {'LOCATION'}")
print("-" * 80)

result = db.table("hotel_directory").select("id, name, serp_api_id, location").execute()

mock_keywords = ["Budget Inn", "City Center Hotel", "Luxury Suites", "Ocean Breeze", "Seaside Palace", "Royal Plaza", "Mountain View Lodge", "Holiday Resort", "Boutique Stay", "Grand Resort"]
mock_found = []

for h in result.data or []:
    name = h.get("name") or ""
    # More robust mock detection: keyword + number at the end
    is_mock = False
    for kw in mock_keywords:
        if name.startswith(kw):
            # Check if it ends with a number
            parts = name.split()
            if parts and parts[-1].isdigit():
                is_mock = True
                break
    
    if is_mock or not h.get("serp_api_id"):
        mock_found.append(h)
        serp_id = h.get("serp_api_id") or "N/A"
        print(f"{name:<40} | {serp_id:<25} | {h['location']}")

print("-" * 80)
print(f"Total Hotels in Directory: {len(result.data or [])}")
print(f"Mock/Unusable Hotels Found: {len(mock_found)}")
print("-" * 80)

if mock_found:
    print("Do you want to delete these from hotel_directory? (Run with --delete)")
    if "--delete" in sys.argv:
        print("Deleting...")
        for h in mock_found:
            db.table("hotel_directory").delete().eq("id", h["id"]).execute()
            print(f"Deleted: {h['name']}")
        print("Done.")
