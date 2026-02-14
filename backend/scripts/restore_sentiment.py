import asyncio
import os
import sys
from datetime import datetime

# Add backend directory to path - assuming script is in backend/scripts/
# We need to add the parent of 'backend' to sys.path to import 'backend.utils'
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(project_root)

# Add local libs
libs_path = os.path.join(project_root, "backend", "libs")
if libs_path not in sys.path:
    sys.path.append(libs_path)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))
load_dotenv(os.path.join(project_root, ".env.local"), override=True)
load_dotenv(os.path.join(project_root, "backend", ".env"))
load_dotenv(os.path.join(project_root, "backend", ".env.local"), override=True)

from backend.utils.db import get_supabase

async def restore_sentiment():
    """
    Restores missing sentiment_breakdown in 'hotels' table from 'sentiment_history'.
    """
    db = get_supabase()
    if not db:
        print("Database connection failed.")
        return

    print("Fetching hotels...")
    hotels_res = db.table("hotels").select("id, name, sentiment_breakdown").execute()
    hotels = hotels_res.data or []

    updated_count = 0
    
    for hotel in hotels:
        hotel_id = hotel["id"]
        current_breakdown = hotel.get("sentiment_breakdown") or []
        print(f"Hotel: {hotel['name']} (ID: {hotel_id})")
        if "Ramada" in hotel["name"]:
            print(f"Keys for {hotel['name']}: {[i.get('name') for i in current_breakdown]}")
        
        # Check if current is empty or sparse
        # Fetch best history regardless to see what's there
        
        # Get last 20 entries
        history_res = db.table("sentiment_history")\
            .select("sentiment_breakdown, recorded_at, review_count")\
            .eq("hotel_id", hotel_id)\
            .order("recorded_at", desc=True)\
            .limit(200)\
            .execute()
            
        history = history_res.data or []
        print(f" - History Entries Found: {len(history)}")
        
        if not history:
            print(f" - No history found.")
            continue
            
        # Find the richest entry
        best_entry = None
        max_items = 0
        best_date = None
        
        for entry in history:
            breakdown = entry.get("sentiment_breakdown") or []
            if len(breakdown) > max_items:
                max_items = len(breakdown)
                best_entry = breakdown
                best_date = entry.get("recorded_at")
        
        print(f" - Best History: {max_items} items from {best_date}")

        if best_entry and max_items > len(current_breakdown):
            print(f" -> RESTORING {max_items} items (Current: {len(current_breakdown)})")
            
            db.table("hotels").update({
                "sentiment_breakdown": best_entry, # Restore breakdown
                #"reviews": ... # Could verify reviews too
            }).eq("id", hotel_id).execute()
            
            updated_count += 1
        else:
            print(f" - Current is better or equal to history.")

    print(f"Restoration Complete. Updated {updated_count} hotels.")

if __name__ == "__main__":
    from datetime import datetime
    asyncio.run(restore_sentiment())
