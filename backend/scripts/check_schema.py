
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

try:
    print("Fetching one row from user_profiles to inspect keys...")
    res = supabase.table("user_profiles").select("*").limit(1).execute()
    if res.data:
        print("Columns found:", list(res.data[0].keys()))
    else:
        print("Table appears empty, cannot infer columns easily via select. Trying to insert dummy to see error or checking postgrest info.")
        # Attempting a dummy select with error expectation if column invalid
        try:
             supabase.table("user_profiles").select("role").limit(1).execute()
             print("Column 'role' EXISTS.")
        except Exception as e:
             print(f"Column 'role' PROBABLY MISSING: {e}")

except Exception as e:
    print(f"Error: {e}")
