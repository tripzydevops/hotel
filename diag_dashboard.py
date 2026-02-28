
import os
import asyncio
import sys
from uuid import UUID

# Mocking the folder structure for import
sys.path.append("/home/tripzydevops/hotel")

def load_env_manual(path):
    if not os.path.exists(path):
        return
    with open(path, "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value.strip("'\"")

async def diag():
    load_env_manual(".env.local")
    from backend.utils.db import get_supabase
    from backend.services.dashboard_service import get_dashboard_logic
    from supabase import create_client

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    db = create_client(url, key)

    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a" # From user screenshot
    
    print(f"Running dashboard logic for {user_id}...")
    try:
        data = await get_dashboard_logic(user_id, user_id, "admin@hotel.plus", db)
        if data.get("error"):
            print(f"Logic returned error: {data['error']}")
        else:
            print("Logic succeeded!")
            print(f"Hotels found: {len(data.get('competitors', [])) + (1 if data.get('target_hotel') else 0)}")
    except Exception as e:
        print(f"CRITICAL CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(diag())
