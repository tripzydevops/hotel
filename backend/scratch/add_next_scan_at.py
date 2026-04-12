import os, sys
sys.path.insert(0, "/home/tripzydevops/hotel")
os.chdir("/home/tripzydevops/hotel")
from dotenv import load_dotenv
load_dotenv(".env.local")
from backend.utils.db import get_supabase_client

db = get_supabase_client(admin=True)

res = db.table("profiles").select("id").limit(1).execute()
print("Profiles schema before migration retrieved:", res.data)

