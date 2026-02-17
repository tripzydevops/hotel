
import asyncio
from unittest.mock import MagicMock
from backend.services.dashboard_service import get_dashboard_logic
from backend.utils.db import get_supabase
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

async def test_dashboard_logic_crash():
    print("--- Verifying Dashboard Logic for Crashes ---")
    db = get_supabase()
    
    # Mock user and current user
    # We need a real user_id from the DB to avoid 404/Empty but let's try a mock first
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a" # From screenshot
    current_user_id = user_id
    current_user_email = "test@example.com"
    
    print(f"Testing dashboard logic for user: {user_id}")
    
    try:
        # We wrap it to see if it triggers the 'name not defined' error
        data = await get_dashboard_logic(user_id, current_user_id, current_user_email, db)
        print("✅ Dashboard logic executed without crash")
        if data.get("target_hotel"):
            print(f"✅ Target hotel data found: {data['target_hotel'].get('name')}")
            sent = data["target_hotel"].get("sentiment_breakdown", [])
            print(f"--- Sentiment Pillars ({len(sent)}) ---")
            for p in sent:
                print(f"  {p['name']}: {p.get('rating')} (Score found: {p.get('rating') is not None})")
            
            val = next((p for p in sent if p["name"] == "Value"), None)
            if val:
                print(f"✅ Value sentiment: {val.get('rating')} (Synthetic: {val.get('synthetic', False)})")
                
    except NameError as e:
        print(f"❌ CRASH: {e}")
        exit(1)
    except Exception as e:
        print(f"ℹ️ Note: Service returned error (likely data related), but not a NameError: {e}")

if __name__ == "__main__":
    asyncio.run(test_dashboard_logic_crash())
