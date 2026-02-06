import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

def run_migration():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials missing (SERVICE_ROLE_KEY required).")
        return

    print("Connecting to Supabase...")
    db = create_client(url, key)

    # 1. Check if column exists
    print("Checking schema...")
    try:
        # Use search_rank to avoid conflict
        db.table("price_logs").select("search_rank").limit(1).execute()
        print("[OK] Column 'search_rank' already exists in 'price_logs'. Verified.")
        return
    except Exception as e:
        # Check if error is 'column does not exist' vs other
        if "42703" in str(e) or "does not exist" in str(e):
             print("[INFO] Column 'search_rank' not found. Proceeding with migration...")
        else:
             print(f"[INFO] Initial check failed (expected if new): {e}")

    # 2. Try to execute SQL via RPC
    sql = "ALTER TABLE price_logs ADD COLUMN IF NOT EXISTS search_rank INTEGER DEFAULT NULL;"
    
    try:
        print(f"Attempting to execute via RPC 'exec_sql': {sql}")
        res = db.rpc("exec_sql", {"query": sql}).execute()
        print("[SUCCESS] Migration Success via RPC!")
    except Exception as e:
        print(f"[WARN] RPC Execution failed: {e}")
        print("\n[ACTION REQUIRED] Automatic migration failed because 'exec_sql' RPC is missing.")
        print("Please run this SQL in your Supabase SQL Editor:")
        print("-" * 40)
        print(sql)
        print("-" * 40)

if __name__ == "__main__":
    run_migration()
