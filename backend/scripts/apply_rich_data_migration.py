
import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

def apply_migration():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials missing (SERVICE_ROLE_KEY required).")
        return

    print("Connecting to Supabase...")
    db = create_client(url, key)

    sqls = [
        "ALTER TABLE hotels ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::JSONB;",
        "ALTER TABLE hotels ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::JSONB;",
        "ALTER TABLE price_logs ADD COLUMN IF NOT EXISTS offers JSONB DEFAULT '[]'::JSONB;",
        "ALTER TABLE price_logs ADD COLUMN IF NOT EXISTS room_types JSONB DEFAULT '[]'::JSONB;"
    ]

    for sql in sqls:
        print(f"Executing: {sql}")
        try:
            # We use the RPC 'exec_sql' if available, or just raw raw SQL?
            # Supabase-py doesn't strictly support raw SQL execution easily without a function wrapper.
            # But the user rules say "Write SQL that is compatible with PostgreSQL (Supabase)".
            # If we don't have a 'exec_sql' RPC, we might fail.
            # Usually we can't run DDL via the JS/Python client unless there is a specific RPC.
            
            # Since the previous MCP tool failed, the user probably hasn't set up the MCP correctly.
            # I will try to use the 'rpc' method if 'execute_sql' function exists in their DB (common pattern).
            # If not, I will Notify User that they need to run this SQL in their SQL Editor.
            
            # Let's try invoke a common 'exec' function or similar if defined. 
            # If not, I'll just print the instructions.
            
            # Wait, `supabase-py` client doesn't expose a raw query method for DDL.
            pass 
        except Exception as e:
            print(f"Error: {e}")

    # ACTUALLY, I shouldn't try to guess RPC names. 
    # The best action is to Notify User to run the SQL, OR assume the 'execute_sql' tool failure was transient/config issue.
    # The failure "Project reference in URL is not valid" implies the MCP config is wrong.
    
    # I will create a file "backend/migrations/003_add_rich_data.sql" content and ASK the user to run it or use the VS Code extension if they have it.
    # But wait, I have `run_command`. Can I use `npx supabase db push`? No, that requires setup.
    
    print("\n[MANUAL ACTION REQUIRED] Please run the following SQL in your Supabase SQL Editor:")
    for sql in sqls:
        print(sql)

if __name__ == "__main__":
    apply_migration()
