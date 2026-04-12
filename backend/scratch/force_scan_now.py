"""Force scan all hotels for the user and fetch results immediately"""
import asyncio, os, sys, time
sys.path.insert(0, "/home/tripzydevops/hotel")
os.chdir("/home/tripzydevops/hotel")

from dotenv import load_dotenv
load_dotenv(".env.local")

from backend.utils.db import get_supabase_client
from backend.services.monitor_service import process_system_scans, run_monitor_background

async def main():
    db = get_supabase_client(admin=True)
    
    # 1. Get the first user id that has hotels
    res = db.table("user_hotels").select("user_id, hotel_id").limit(1).execute()
    if not res.data:
        print("No users with hotels found.")
        return
        
    user_id = res.data[0]["user_id"]
    print(f"Triggering scan for user: {user_id}")

    # fetch all hotels for this user
    user_hotels_res = db.table("user_hotels").select("hotel_id").eq("user_id", user_id).execute()
    hotel_ids = [row["hotel_id"] for row in user_hotels_res.data]
    
    if not hotel_ids:
        print("No hotels mapped to this user.")
        return
        
    hotels_res = db.table("hotels").select("*").in_("id", hotel_ids).execute()
    
    # Create a dummy session
    session_res = db.table("scan_sessions").insert({
        "user_id": user_id,
        "session_type": "manual",
        "status": "processing",
        "hotels_count": len(hotels_res.data) # Will update inside run_monitor_background
    }).execute()
    session_id = session_res.data[0]["id"]

    # 2. Trigger scan
    try:
        await run_monitor_background(
            user_id=user_id,
            hotels=hotels_res.data,
            options=None,
            db=db,
            session_id=session_id
        )
        print(f"Scan triggered successfully. Session ID: {session_id}")
    except Exception as e:
        print(f"Failed to submit manual scan: {e}")
        return

    # 3. Wait a bit for DataForSEO to complete tasks
    wait_time = 45
    print(f"\nWaiting for {wait_time} seconds to allow tasks to complete...")
    for i in range(wait_time):
        sys.stdout.write(".")
        sys.stdout.flush()
        await asyncio.sleep(1)
    print("\n\nChecking ready tasks and syncing back...")

    # 4. Process system scans (fetch ready tasks)
    await process_system_scans(db)

    # 5. Check session status
    sess_res = db.table("scan_sessions").select("*").eq("id", str(session_id)).execute()
    if sess_res.data:
        sess = sess_res.data[0]
        print(f"\nFinal Session Status: {sess.get('status')} | Success: {sess.get('success_count')} | Fail: {sess.get('fail_count')}")
    
    # 6. Check hotel prices updated
    updated_hotels = db.table("hotels").select("name, current_price, previous_price, last_scanned_at").in_("id", hotel_ids).execute()
    print("\nHotels state:")
    for h in updated_hotels.data:
        print(f"  {h['name']}: {h['current_price']} (previous: {h['previous_price']}, scanned at {h.get('last_scanned_at')})")

asyncio.run(main())
