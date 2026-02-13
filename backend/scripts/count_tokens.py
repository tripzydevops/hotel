import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Use the existing testing credentials
dotenv_path = "/home/successofmentors/.gemini/antigravity/scratch/hotel/.env.testing"
load_dotenv(dotenv_path)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase URL or Service Role Key missing in .env.testing")
    exit(1)

supabase: Client = create_client(url, key)

# Get all hotels
print("Fetching hotels...")
result = supabase.table("hotels").select("id, name, property_token, serp_api_id").execute()
all_hotels = result.data

total_hotels = len(all_hotels)
hotels_with_token = [h for h in all_hotels if h.get("property_token") or h.get("serp_api_id")]
count_with_token = len(hotels_with_token)

print(f"\n--- Statistics ---")
print(f"Total Hotels in Database: {total_hotels}")
print(f"Hotels with Property Token/SerpApi ID: {count_with_token}")
print(f"Hotels missing tokens: {total_hotels - count_with_token}")

if count_with_token > 0:
    print(f"\n--- First 5 Hotels with Tokens ---")
    for h in hotels_with_token[:5]:
        token = h.get("property_token") or h.get("serp_api_id")
        print(f"- {h['name']} ({token})")
