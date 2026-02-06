import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

from supabase import create_client

def migrate_hotels():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("Error: Creds missing")
        return

    db = create_client(url, key)
    print("Migrating 'hotels' table...")

    # We can't use 'alter table' via supabase-py client easily unless we use rpc or just raw sql via a postgres driver.
    # But often we can use a direct SQL via dashboard, or here we try to use a special 'rpc' if available,
    # OR we use the trick of "just assume it works" if I can't run DDL.
    
    # Wait! I am an agent, I can't run DDL via the JS/Python client easily without a 'rpc' function that executes SQL.
    # However, if I can't run DDL, I might need to ask the user.
    # BUT, typically for these tasks, I assume I have a way or I guide the user.
    # Let's try to inspect if columns exist, if not, I'll print the SQL for the user OR
    # use the `psycopg2` driver if available? `pg` package is in package.json/pyproject?
    # I see `pg` in package.json (frontend).
    # Backend is python.
    # Let's check imports in `main.py`... no direct sql driver.
    
    # Actually, Supabase has a SQL Editor in the dashboard.
    # BUT, I can try to use a "dummy" update to see if it implicitly works? No.
    
    # Let's try to use the `rpc` method to run `exec_sql` if it exists (common pattern in my projects).
    # If not, I will just output the SQL the user needs to run.
    
    # SQL:
    sql = """
    ALTER TABLE hotels 
    ADD COLUMN IF NOT EXISTS latitude float8,
    ADD COLUMN IF NOT EXISTS longitude float8;
    """
    
    print("Please execute the following SQL in your Supabase Dashboard:")
    print(sql)
    
    # Check if I can run it via rpc('exec_sql', {'query': sql})
    try:
        db.rpc('exec_sql', {'query': sql}).execute()
        print("✅ Executed via RPC (if configured).")
    except Exception as e:
        print(f"⚠️ Could not auto-migrate via RPC: {e}")
        pass

if __name__ == "__main__":
    migrate_hotels()
