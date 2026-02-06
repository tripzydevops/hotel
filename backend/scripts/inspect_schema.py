import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env.local explicitly
load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"DEBUG: Loaded URL: '{url}'") 
print(f"DEBUG: Loaded KEY: '{key[:5]}...' if key else 'None'")

if not url or not key:
    print("Error: Env vars not set.")
    exit(1)

supabase: Client = create_client(url, key)

async def inspect():
    # Use a dummy query to inspect response if possible, or just check a single row
    # Supabase-py client doesn't have a direct 'describe table' method easily accessible 
    # without raw SQL or checking a row.
    try:
        # Fetch one row to see keys
        res = supabase.table("price_logs").select("*").limit(1).execute()
        if res.data:
            print("Columns in price_logs:", list(res.data[0].keys()))
            if "room_types" in res.data[0]:
                print("Confirmed: 'room_types' column exists.")
                print("Sample value:", res.data[0]["room_types"])
            else:
                print("WARNING: 'room_types' column NOT FOUND in response data (might be null or missing).")
        else:
            print("No data in price_logs to inspect columns from.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(inspect())
