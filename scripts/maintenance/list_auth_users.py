import os
from dotenv import load_dotenv
from yarl import URL

# Load env variables from .env.vm
env_path = os.path.join(os.path.dirname(__file__), "backend", ".env.vm")
load_dotenv(env_path)

from supabase import create_client, ClientOptions

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

options = ClientOptions().replace(auto_refresh_token=False, persist_session=False)
client = create_client(url, key, options=options)
clean_base = url.rstrip("/")
client.postgrest.base_url = URL(f"{clean_base}/api/database/records")

try:
    print("Fetching auth users...")
    auth_users = client.auth.admin.list_users()
    print(f"Found {len(auth_users)} auth users:")
    for idx, u in enumerate(auth_users):
        print(f"  User {idx}: id={u.id}, email={u.email}, created_at={u.created_at}")
except Exception as e:
    print(f"Error listing auth users: {e}")
