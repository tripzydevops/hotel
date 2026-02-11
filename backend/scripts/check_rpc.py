
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Credentials missing")
    sys.exit(1)

supabase = create_client(url, key)

try:
    print("Testing exec_sql RPC...")
    res = supabase.rpc("exec_sql", {"query": "SELECT 1"}).execute()
    print("Success:", res)
except Exception as e:
    print("Failed:", e)
