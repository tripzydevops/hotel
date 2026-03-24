from backend.utils.db import get_supabase
from backend.utils.logger import get_logger

logger = get_logger(__name__)

import os

def load_env():
    env_path = "/home/successofmentors/hotel/.env.local"
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ[k] = v.strip('"')

async def list_data():
    load_env()
    db = get_supabase()
    res = db.table("hotels").select("user_id, name").limit(5).execute()
    for row in res.data:
        print(f"User: {row['user_id']} | Hotel: {row['name']}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(list_data())
