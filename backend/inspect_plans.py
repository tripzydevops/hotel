
import asyncio
import os
# Force reload if needed
from dotenv import load_dotenv
import os
from supabase import create_client, Client

# Try loading from possible locations
load_dotenv(".env.local")
load_dotenv(".env")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"Debug: URL found: {bool(url)}")
print(f"Debug: Key found: {bool(key)}")

if not url:
    print("Error: NEXT_PUBLIC_SUPABASE_URL is not set.")
    exit(1)
if not key:
    print("Error: SUPABASE_SERVICE_ROLE_KEY is not set.")
    exit(1)

# Type assertion for linters
assert url is not None
assert key is not None

try:
    supabase: Client = create_client(url, key)
except Exception as e:
    print(f"Error creating Supabase client: {e}")
    exit(1)

async def inspect_plans():
    print("--- Inspecting 'user_profiles' table for 'plan_type' ---")
    try:
        # Fetch all profiles
        response = supabase.table("user_profiles").select("user_id, email, plan_type, role").execute()
        
        if not response.data:
            print("No profiles found in 'user_profiles'.")
            return

        print(f"Found {len(response.data)} profiles.")
        print(f"{'Email':<30} | {'Role':<15} | {'Plan Type':<15}")
        print("-" * 65)
        
        for p in response.data:
            email = p.get('email', 'N/A')
            role = p.get('role', 'N/A')
            plan = p.get('plan_type', 'N/A')
            print(f"{email:<30} | {role:<15} | {plan:<15}")

    except Exception as e:
        print(f"Error querying database: {e}")

if __name__ == "__main__":
    asyncio.run(inspect_plans())
