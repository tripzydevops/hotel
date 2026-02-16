import os
import sys
from dotenv import load_dotenv
load_dotenv()
load_dotenv(".env.local", override=True)
from supabase import create_client, Client

def run_migration():
    """Reads SQL from stdin and executes it via Supabase RPC or Direct execution if possible."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Must use Service Role for schema changes

    if not url or not key:
        print("Error: Missing SUPABASE credentials in env.")
        sys.exit(1)

    try:
        supabase: Client = create_client(url, key)
        
        # Determine source of SQL
        if len(sys.argv) > 1:
            # Read from file argument
            file_path = sys.argv[1]
            if not os.path.exists(file_path):
                print(f"Error: File not found: {file_path}")
                sys.exit(1)
            with open(file_path, 'r') as f:
                sql_content = f.read()
            print(f"Reading SQL from file: {file_path}")
        else:
            # Read SQL from stdin (piped content)
            if sys.stdin.isatty():
                print("Usage: python3 run_migration.py <file.sql> OR cat file.sql | python3 run_migration.py")
                return
            sql_content = sys.stdin.read()
        
        if not sql_content.strip():
            print("No SQL content provided.")
            return

        print(f"Executing SQL len={len(sql_content)}...")
        
        # Supabase-py doesn't currently support "raw sql" widely on free tier without RPC
        # BUT, we can try to use a "pgaudit" or similar RPC if established, 
        # or we assume the user has a setup for this.
        # Fallback: We can't easily run DDL via client-lib without a specific RPC function `exec_sql`.
        # Let's try to assume an `exec_sql` RPC exists, or print instructions if it fails.
        
        try:
            res = supabase.rpc("exec_sql", {"query": sql_content}).execute()
            print("Migration Success via RPC:", res)
        except Exception as rpc_error:
            # If RPC fails (common if not set up), we might warn the user.
            # But let's try a direct Postgres connection if we had psycopg2 (we don't here standardly).
            # Creating a dummy "sql" function is the standard Supabase workaround.
            print(f"RPC Execution failed: {rpc_error}")
            print("\n[CRITICAL] To run migrations, please create this function in Supabase SQL Editor:")
            print("""
            create or replace function exec_sql(query text)
            returns void
            language plpgsql
            security definer
            as $$
            begin
              execute query;
            end;
            $$;
            """)
            sys.exit(1)

    except Exception as e:
        print(f"Migration Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
