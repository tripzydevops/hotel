"""
Script to delete hotels without property_token or serp_api_id from the database.
These hotels cannot be scanned and are essentially useless.
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

# Step 1: Find hotels without property_token AND without serp_api_id
print("=" * 60)
print("HOTELS WITHOUT PROPERTY TOKENS (will be deleted)")
print("=" * 60)

# Fetch all hotels
all_hotels = db.table("hotels").select("id, name, user_id, property_token, serp_api_id, created_at").execute()

hotels_to_delete = []
for h in all_hotels.data or []:
    has_token = h.get("property_token") or h.get("serp_api_id")
    if not has_token:
        hotels_to_delete.append(h)
        print(f"  - {h['name']} (ID: {h['id'][:8]}..., User: {h.get('user_id', 'N/A')[:8]}...)")

print()
print(f"Total hotels to delete: {len(hotels_to_delete)}")
print(f"Total hotels remaining: {len(all_hotels.data or []) - len(hotels_to_delete)}")
print()

if not hotels_to_delete:
    print("No hotels to delete. All hotels have property tokens.")
    sys.exit(0)

# Step 2: Delete them
print("Deleting hotels...")
deleted_count = 0
for h in hotels_to_delete:
    try:
        db.table("hotels").delete().eq("id", h["id"]).execute()
        deleted_count += 1
        print(f"  Deleted: {h['name']}")
    except Exception as e:
        print(f"  Failed to delete {h['name']}: {e}")

print()
print(f"Successfully deleted {deleted_count} hotels without property tokens.")
