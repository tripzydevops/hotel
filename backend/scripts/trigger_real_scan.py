import asyncio
import os
import sys
import json
from datetime import date, timedelta
from uuid import UUID

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.utils.db import get_supabase
from backend.agents.scraper_agent import ScraperAgent
from backend.agents.analyst_agent import AnalystAgent
from backend.models.schemas import ScanOptions

async def main():
    print("🚀 Initializing Real-World Deep Scan Full Orchestrator...")
    
    # 1. Setup Admin DB Client
    db = get_supabase(admin=True)
    if not db:
        print("❌ Failed to initialize Supabase client.")
        return

    # 2. Define Target User and Hotels
    # successofmentors@gmail.com
    USER_ID = "b2d0ee10-6ee0-4d0e-b12c-fd14f1a5486f" 
    HOTEL_IDS = [
        "b72eadfa-5c97-42f0-80ad-918e0c98fca5", # Altın Otel
        "d5dcbf96-8b78-428a-9949-a358ef0f213c", # Hilton Garden Inn Balikesir
        "5813579f-c81a-4871-8ac4-23d1a780b1c4", # Willmont Hotel
        "f9417132-587a-4178-8768-d12514b1e68d"  # Ramada Residences
    ]

    # 3. Fetch User Settings for realistic threshold
    settings_res = db.table("settings").select("*").eq("user_id", USER_ID).execute()
    settings = settings_res.data[0] if settings_res.data else {}
    threshold = settings.get("alert_threshold_percent", 2.0)
    
    print(f"📍 Target User: {USER_ID}")
    print(f"📍 Threshold: {threshold}%")

    # 4. Create Scan Session (To trace the reasoning)
    session_res = db.table("scan_sessions").insert({
        "user_id": USER_ID,
        "status": "running",
        "session_type": "manual"
    }).execute()
    session_id = session_res.data[0]["id"] if session_res.data else None
    print(f"📊 Session Created: {session_id}")

    # 5. Load Hotel Data
    res = db.table("hotels").select("*").in_("id", HOTEL_IDS).execute()
    hotels = res.data
    if not hotels:
        print("❌ No hotels found for the specified IDs.")
        return

    # 6. Configure Scan Options
    check_in = date.today() + timedelta(days=1)
    check_out = check_in + timedelta(days=1)
    
    options = ScanOptions(
        adults=2,
        check_in=check_in.isoformat(),
        check_out=check_out.isoformat(),
        currency="TRY",
        skip_cache=True, 
        deep_scan=True 
    )

    # 7. PHASE 1: ScraperAgent (Fetch)
    scraper = ScraperAgent(db)
    print("🛰️  PHASE 1: Launching ScraperAgent Mesh...")
    scraper_results = await scraper.run_scan(UUID(USER_ID), hotels, options, session_id=session_id)
    
    # 8. PHASE 2: AnalystAgent (Persist)
    analyst = AnalystAgent(db)
    print("🧠 PHASE 2: Launching AnalystAgent Persistence...")
    # persist_results_only(user_id, scraper_results, threshold, settings, options, session_id)
    analysis_summary = await analyst.persist_results_only(
        UUID(USER_ID), 
        scraper_results, 
        threshold=threshold, 
        settings=settings, 
        options=options, 
        session_id=session_id
    )

    # 9. Finalize Session
    db.table("scan_sessions").update({
        "status": "completed",
        "completed_at": date.today().isoformat()
    }).eq("id", str(session_id)).execute()

    print("\n✅ Full Scan Pipeline Complete!")
    print("-" * 50)
    
    # 10. Verify Results
    print("\n🔍 FINAL VERIFICATION: Querying 'price_logs' for NEW entries...")
    recent_logs_res = db.table("price_logs").select("*").in_("hotel_id", HOTEL_IDS).order("recorded_at", desc=True).limit(4).execute()
    
    if recent_logs_res.data:
        print(f"Found {len(recent_logs_res.data)} brand new entries in DB:")
        for log in recent_logs_res.data:
            h_name = next((h["name"] for h in hotels if h["id"] == log["hotel_id"]), "Unknown")
            is_deep = log.get("is_deep_scan")
            rooms = len(log.get("room_types", [])) if log.get("room_types") else 0
            offers = len(log.get("offers", [])) if log.get("offers") else 0
            
            print(f"   🏨 {h_name.ljust(35)} | Deep Scan: {'✅' if is_deep else '❌'} | Rooms: {rooms} | Offers: {offers}")
    else:
        print("❌ Verification Failed: No recent logs found. Check script errors.")

    print("\n🔍 GRANULAR REVIEW VERIFICATION: Checking 'hotel_reviews' table...")
    recent_reviews_res = db.table("hotel_reviews").select("*").in_("hotel_id", HOTEL_IDS).order("recorded_at", desc=True).limit(10).execute()
    if recent_reviews_res.data:
        print(f"✅ Success! Found {len(recent_reviews_res.data)} granular reviews in 'hotel_reviews' table.")
        for rev in recent_reviews_res.data[:3]:
            print(f"   - [{rev['hotel_id']}] {rev['author']}: {str(rev['text'])[:50]}...")
    else:
        print("⚠️  No granular reviews found. This is expected if the deep scan didn't return fresh review objects, or if the scraper was cached.")

if __name__ == "__main__":
    asyncio.run(main())
