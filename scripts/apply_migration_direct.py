
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

SQL = """
-- Migration: Add scheduling columns to profiles if they don't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS next_scan_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS scan_frequency_minutes INTEGER DEFAULT 1440;

-- Backfill existing users
UPDATE profiles SET next_scan_at = NOW() WHERE next_scan_at IS NULL;
UPDATE profiles SET scan_frequency_minutes = 1440 WHERE scan_frequency_minutes IS NULL;
"""

def run_sql():
    # Attempt to use the REST API to execute SQL if the project has the pg-meta extension or similar enabled,
    # but standard Supabase doesn't expose raw SQL via REST to js/python clients easily without an RPC.
    # 
    # Plan B: Use the `postgres` library if available, or just try to find if there is a `run_sql` RPC.
    
    # Let's try to check if there is an RPC for running SQL (common pattern in some projects).
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try generic 'exec' or 'run_sql' names? 
    # Or better: check if we can simply use the `postgres` connection string if available in env?
    # Usually `DATABASE_URL` is provided.
    
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        print("Connecting directly to Postgres...")
        try:
            import psycopg2
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            cur.execute(SQL)
            conn.commit()
            print("Migration applied successfully via psycopg2!")
            cur.close()
            conn.close()
            return
        except Exception as e:
            print(f"Direct connection failed: {e}")
            print("Falling back to other methods...")

    print("Could not apply migration. Please apply the following SQL manually in the Supabase Dashboard SQL Editor:")
    print(SQL)

if __name__ == "__main__":
    run_sql()
