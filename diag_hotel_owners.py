
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diag_hotel_owners():
    print("--- Hotel Owner Map ---")
    # Fetch all hotels
    h_res = supabase.table("hotels").select("*").execute()
    # Fetch all user profiles
    u_res = supabase.table("user_profiles").select("user_id, email, display_name").execute()
    
    user_map = {u['user_id']: u for u in u_res.data}
    
    for h in h_res.data:
        user = user_map.get(h['user_id'], {'email': 'Unknown', 'display_name': 'Unknown'})
        print(f"Hotel: {h['name']} ({h['id']})")
        print(f"  Owner: {user['email']} ({user['display_name']})")
        print(f"  Target: {h.get('is_target_hotel')}")
        print(f"  Created At: {h.get('created_at')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(diag_hotel_owners())
