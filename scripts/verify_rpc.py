
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
load_dotenv(".env.local", override=True)

def verify_rpc():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase: Client = create_client(url, key)
    
    try:
        # Try a simple select
        res = supabase.rpc("exec_sql", {"query": "SELECT 1"}).execute()
        print("RPC 'exec_sql' exists and works!")
    except Exception as e:
        print(f"RPC 'exec_sql' failed: {e}")

if __name__ == "__main__":
    verify_rpc()
