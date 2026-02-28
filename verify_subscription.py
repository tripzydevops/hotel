
import os
import asyncio
from supabase import create_client

# Mocking the folder structure for import
import sys
sys.path.append("/home/tripzydevops/hotel")

from backend.services.subscription import SubscriptionService

def load_env_manual(path):
    if not os.path.exists(path):
        return
    with open(path, "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value.strip("'\"")

async def verify():
    load_env_manual(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    db = create_client(url, key)
    
    print("Testing get_all_tiers...")
    tiers = await SubscriptionService.get_all_tiers(db)
    print("Fetched Tiers:", tiers)
    
    # Verify one specific limit
    if "pro" in tiers:
        print(f"Pro Hotel Limit: {tiers['pro'].get('hotel_limit')}")
        print(f"Pro UI Comparison Limit: {tiers['pro'].get('ui_comparison_limit')}")
    else:
        print("ALERT: 'pro' tier not found in fetched data!")
        # Print keys in tiers for debugging
        print("Tier keys found:", list(tiers.keys()))

if __name__ == "__main__":
    asyncio.run(verify())
