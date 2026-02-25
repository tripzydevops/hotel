
import os
import sys
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.getcwd())

# Load environment
load_dotenv(".env.local", override=True)

from backend.utils.db import get_supabase
db = get_supabase()

if not db:
    print("Error: Supabase client not available. Check .env.local")
    sys.exit(1)

# Search by email or display_name
print("Searching for tripzydevops...")
res = db.table("user_profiles").select("*").or_("display_name.ilike.%tripzydevops%,email.ilike.%tripzydevops%").execute()

if res.data:
    for u in res.data:
        print(f"ID: {u['user_id']} | Email: {u['email']} | Name: {u['display_name']}")
else:
    # Try searching for all users to see what's there
    print("Specific search failed. Listing top 5 users...")
    all_users = db.table("user_profiles").select("user_id, email, display_name").limit(5).execute()
    for u in all_users.data:
        print(f"ID: {u['user_id']} | Email: {u['email']} | Name: {u['display_name']}")
