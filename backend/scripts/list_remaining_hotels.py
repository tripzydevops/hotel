"""
Script to list all hotels currently in the database.
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
print(f"{'HOTEL NAME':<40} | {'PROPERTY TOKEN':<25} | {'USER ID'}")
print("-" * 80)

result = db.table("hotels").select("name, property_token, serp_api_id, user_id").execute()

for h in result.data or []:
    token = h.get("property_token") or h.get("serp_api_id") or "N/A"
    print(f"{h['name']:<40} | {token:<25} | {h['user_id'][:8]}...")

print("-" * 80)
print(f"Total Hotels: {len(result.data or [])}")
