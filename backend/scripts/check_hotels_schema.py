import os
import sys
from dotenv import load_dotenv
from supabase import create_client

sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

def check_hotels_schema():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials missing.")
        return

    db = create_client(url, key)
    print("Checking 'hotels' table columns...")
    
    try:
        res = db.table("hotels").select("*").limit(1).execute()
        if res.data:
            columns = list(res.data[0].keys())
            print(f"Found {len(columns)} columns in 'hotels':")
            for col in columns:
                status = "[GEO]" if col in ["latitude", "longitude"] else ""
                print(f"   - {col} {status}")
            
            missing = [c for c in ["latitude", "longitude"] if c not in columns]
            if not missing:
                print("\nSUCCESS: Database HAS geo columns.")
            else:
                print(f"\nFAILURE: Missing columns: {missing}")
        else:
            print("Table is empty.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_hotels_schema()
