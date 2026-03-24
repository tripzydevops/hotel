
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
load_dotenv(".env.local", override=True)

def reload_schema():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase: Client = create_client(url, key)
    
    try:
        # Trigger schema reload
        print("Reloading PostgREST schema cache...")
        res = supabase.rpc("exec_sql", {"query": "NOTIFY pgrst, 'reload schema'"}).execute()
        print("Schema reload notification sent.")
    except Exception as e:
        print(f"Schema reload failed: {e}")

if __name__ == "__main__":
    reload_schema()
