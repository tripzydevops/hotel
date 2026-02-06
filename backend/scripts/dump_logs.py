import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client

sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

def dump_logs():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    db = create_client(url, key)
    
    print("Dumping sample from query_logs...")
    try:
        res = db.table("query_logs").select("*").limit(5).execute()
        with open("log_dump.json", "w") as f:
            json.dump(res.data, f, indent=2)
        print("Done. Saved to log_dump.json")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_logs()
