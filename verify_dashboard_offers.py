import os
import sys
import asyncio
import json

# Ensure backend items are discoverable
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def verify_dashboard_offers():
    from backend.utils.db import get_supabase
    from backend.services.dashboard_service import get_dashboard_logic
    
    db = get_supabase()
    if not db:
        print("Database unavailable")
        return

    # Using the tripzydevops user ID from previous check
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    
    print(f"Fetching dashboard for user {user_id}...")
    data = await get_dashboard_logic(
        user_id=user_id,
        current_user_id=user_id,
        current_user_email="tripzydevops@gmail.com",
        db=db
    )
    
    target = data.get("target_hotel")
    if target:
        offers = target.get("price_info", {}).get("offers", [])
        print("Target Hotel: " + str(target.get("name")))
        print("  Offers found: " + str(len(offers)))
        if offers:
            print("  Sample target offer: " + str(offers[0].get("vendor")) + " - " + str(offers[0].get("price")))
    
    competitors = data.get("competitors", [])
    print("Found " + str(len(competitors)) + " competitors")
    for comp in competitors[:3]:
        offers = comp.get("price_info", {}).get("offers", [])
        print("Competitor: " + str(comp.get("name")))
        print("  Offers found: " + str(len(offers)))

if __name__ == "__main__":
    asyncio.run(verify_dashboard_offers())
