
import asyncio
import os
import sys
from uuid import UUID
from datetime import datetime

# Ensure backend module is resolvable
# We align sys.path to the root directory
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "."))
if root_path not in sys.path:
    sys.path.append(root_path)

from backend.utils.db import get_supabase
from backend.services.monitor_service import run_monitor_background, trigger_monitor_logic
from backend.models.schemas import ScanOptions

async def run_kaizen_scan():
    # User: asknsezen@gmail.com
    user_id = UUID("c1ed70a1-7cf6-4d31-b195-5d8908312eab") 
    db = get_supabase()
    
    print(f"--- KAIZEN SCAN START: {datetime.now()} ---")
    
    try:
        # 1. Fetch hotels
        print("Fetching hotels from DB...")
        hotels_res = db.table("hotels").select("*").eq("user_id", str(user_id)).is_("deleted_at", "null").limit(1).execute()
        hotels = hotels_res.data
        print(f"Found {len(hotels)} hotel(s) for user.")
        
        if not hotels:
            print("No hotels found. Seeding a sample hotel...")
            sample_hotel = {
                "user_id": str(user_id),
                "name": "Ramada by Wyndham Istanbul Old City",
                "location": "Istanbul, Turkey",
                "currency": "TRY"
            }
            res = db.table("hotels").insert(sample_hotel).execute()
            hotels = res.data
        
        # 2. Trigger Full Pipeline
        print(f"Executing full scan pipeline for: {hotels[0].get('name')}...")
        options = ScanOptions(force_refresh=True, deep_scan=True)
        
        # KAİZEN: Create explicit session for full telemetry trace
        print("Creating scan session...")
        session_res = db.table("scan_sessions").insert({
            "user_id": str(user_id),
            "session_type": "manual",
            "hotels_count": len(hotels),
            "status": "pending"
        }).execute()
        
        session_id = None
        if session_res.data:
            session_id = UUID(session_res.data[0]["id"])
            print(f"Session Created: {session_id}")
        
        print("Calling run_monitor_background...")
        await run_monitor_background(
            user_id=user_id,
            hotels=hotels,
            options=options,
            db=db,
            session_id=session_id
        )
        
        print(f"Pipeline execution call completed for session {session_id}.")
        
        # 3. Final Verification of Data
        latest_session = db.table("scan_sessions").select("*").eq("user_id", str(user_id)).order("created_at", desc=True).limit(1).single().execute()
        ls_data = latest_session.data
        if ls_data:
            print(f"Latest Session: {ls_data['id']} | Status: {ls_data['status']}")
            logs = db.table("price_logs").select("id").eq("session_id", ls_data['id']).execute()
            print(f"Telemetry Check: {len(logs.data)} logs recorded in session.")
            
    except Exception as e:
        print(f"KAIZEN ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_kaizen_scan())
