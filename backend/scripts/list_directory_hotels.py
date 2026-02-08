"""
Script to list all entries in the hotel_directory table.
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

print("=" * 80)
print(f"{'HOTEL NAME':<40} | {'SERPAPI ID':<25} | {'LOCATION'}")
print("-" * 80)

result = db.table("hotel_directory").select("name, serp_api_id, location").execute()

for h in result.data or []:
    serp_id = h.get("serp_api_id") or "N/A"
    print(f"{h['name']:<40} | {serp_id:<25} | {h['location']}")

print("-" * 80)
print(f"Total Hotels in Directory: {len(result.data or [])}")
