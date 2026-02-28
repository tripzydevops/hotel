
import os

def load_env_manual(path):
    if not os.path.exists(path):
        return {}
    env = {}
    with open(path, "r") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.strip().split("=", 1)
                env[key] = value.strip("'\"")
    return env

def check_schema():
    env = load_env_manual(".env.local")
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    # Use curl to get schema if possible, or just a direct query
    # But wait, supabase-py is safer if I can fix the import issue.
    # Let's try to import it inside a try block with path forcing.
    try:
        import sys
        # Ensure we are not picking up a local 'supabase' folder if it exists
        sys.path = [p for p in sys.path if p != os.getcwd()]
        from supabase import create_client
        db = create_client(url, key)
        res = db.table("hotels").select("*").limit(1).execute()
        if res.data:
            print("Columns in hotels:", list(res.data[0].keys()))
        else:
            print("Hotels table is empty, checking structure via query...")
            # Fallback check
            res = db.table("hotels").select("*").limit(0).execute()
            print("Hotels query (limit 0) succeeded.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
