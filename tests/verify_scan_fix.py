import asyncio
import os
from uuid import UUID
from backend.utils.db import get_supabase
from backend.services.monitor_service import run_monitor_background
from backend.models.schemas import ScanOptions

def load_env():
    env_path = "/home/successofmentors/hotel/.env.local"
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ[k] = v.strip('"')

async def main():
    load_env()
    db = get_supabase()
    user_id = UUID("d33fc277-7006-468f-91b6-8cc7897fd910")
    
    # Get hotel
    res = db.table("hotels").select("*").eq("user_id", str(user_id)).eq("name", "Ramada Residences By Wyndham Balikesir").execute()
    if not res.data:
        print("Hotel not found")
        return
    
    hotel = res.data[0]
    hotels = [hotel]
    
    options = ScanOptions(
        check_in=None,
        check_out=None,
        adults=2,
        currency="TRY"
    )
    
    # Create a test session
    session_res = db.table("scan_sessions").insert({
        "user_id": str(user_id),
        "session_type": "manual_verification",
        "hotels_count": 1,
        "status": "running"
    }).execute()
    session_id = UUID(session_res.data[0]["id"])
    
    print(f"Starting scan for {hotel['name']} (Session: {session_id})...")
    await run_monitor_background(user_id, hotels, options, db, session_id)
    print("Scan complete. Verification in progress...")
    
    # Verify breakdown
    res_final = db.table("hotels").select("sentiment_breakdown").eq("id", hotel["id"]).execute()
    breakdown = res_final.data[0]["sentiment_breakdown"]
    
    has_description = any(item.get("description") for item in breakdown)
    if has_description:
        print("SUCCESS: Sentiment breakdown now contains descriptions!")
        for item in breakdown:
            if item.get("description"):
                print(f"- {item['name']}: {item['description'][:50]}...")
    else:
        print("FAILURE: Sentiment breakdown still missing descriptions.")

if __name__ == "__main__":
    asyncio.run(main())
