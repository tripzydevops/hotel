import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

def check_columns():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials missing (SERVICE_ROLE_KEY required).")
        return

    print("Connecting to Supabase...")
    db = create_client(url, key)

    print("Checking 'price_logs' columns...")
    try:
        # Fetch one record to inspect keys
        res = db.table("price_logs").select("*").limit(1).execute()
        if res.data:
            columns = list(res.data[0].keys())
            print(f"✅ Found {len(columns)} columns in 'price_logs':")
            for col in columns:
                if col == "search_rank":
                    print(f"   - {col} (NEW! 🎯)")
                else:
                    print(f"   - {col}")
            
            if "search_rank" in columns:
                print("\nSUCCESS: Database IS updated. 'search_rank' column exists.")
            else:
                print("\nFAILURE: 'search_rank' column is MISSING.")
        else:
            print("Table is empty, cannot verify columns via select *.")
            # Try specific select to see if it errors
            try:
                db.table("price_logs").select("search_rank").limit(1).execute()
                print("✅ 'search_rank' column exists (Verified via specific select).")
            except Exception as e:
                print(f"❌ 'search_rank' column likely missing. Error: {e}")

    except Exception as e:
        print(f"Error checking schema: {e}")

if __name__ == "__main__":
    check_columns()
