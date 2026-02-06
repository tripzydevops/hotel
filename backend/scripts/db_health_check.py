import os
import sys
import asyncio
from dotenv import load_dotenv
from supabase import create_client

# Add project root to path
sys.path.append(os.getcwd())

async def check_health():
    print("--- Supabase Health Audit ---")
    
    # Explicitly load .env.local
    env_path = ".env.local"
    if os.path.exists(env_path):
        print(f"Loading environment from {env_path}")
        load_dotenv(env_path, override=True)
    else:
        print(f"WARNING: {env_path} not found, falling back to .env")
        load_dotenv()

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        print("ERROR: Supabase credentials missing from environment.")
        return

    print(f"Connecting to: {url}")
    
    try:
        supabase = create_client(url, key)
        
        # 1. Connectivity Check
        res = supabase.table("hotels").select("count", count="precise").limit(1).execute()
        hotel_count = res.count if res.count is not None else 0
        print(f"SUCCESS: Connected to database. Total hotels: {hotel_count}")

        # 2. Table Verification & Schema Introspection
        tables = ["hotels", "price_logs", "query_logs", "settings", "hotel_directory", "alerts"]
        print("\nVerifying tables and columns:")
        for table in tables:
            try:
                res = supabase.table(table).select("*").limit(1).execute()
                print(f"  [OK] {table}")
                if res.data:
                    print(f"    Columns: {list(res.data[0].keys())}")
                else:
                    print("    Columns: (No data found to inspect columns)")
            except Exception:
                print(f"  [FAILED] {table}")
        
        # 3. Check for 'profiles' or 'users' as a mirror
        print("\nChecking for user account tables:")
        for table in ["profiles", "users", "accounts"]:
            try:
                supabase.table(table).select("count", count="precise").limit(1).execute()
                print(f"  [FOUND] {table}")
            except:
                pass

    except Exception as e:
        print(f"CRITICAL ERROR: Failed to communicate with Supabase: {e}")

if __name__ == "__main__":
    asyncio.run(check_health())
