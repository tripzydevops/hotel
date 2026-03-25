from backend.utils.db import get_supabase
import sys

def apply_migration(file_path):
    db = get_supabase()
    with open(file_path, 'r') as f:
        sql = f.read()
    
    try:
        # Note: 'exec_sql' RPC must be enabled on Supabase
        res = db.rpc('exec_sql', {'query': sql}).execute()
        print(f"Migration applied successfully: {file_path}")
    except Exception as e:
        print(f"Failed to apply migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python apply_migration.py <file_path>")
        sys.exit(1)
    apply_migration(sys.argv[1])
