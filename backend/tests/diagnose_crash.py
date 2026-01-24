
import asyncio
import os
import sys
from uuid import UUID

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import get_dashboard, get_analysis, get_supabase

async def diagnose():
    print("🚑 Diagnosing Dashboard 500 Error...")
    
    # Dev User ID from screenshot
    user_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    
    db = get_supabase()
    if not db:
        print("❌ DB Connection Failed")
        return

    print("1. Checking DB connection...")
    try:
        res = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
        print(f"✅ DB Connected. Settings found: {len(res.data)}")
    except Exception as e:
        print(f"❌ DB Check Failed: {e}")
        return

    print("2. Testing get_analysis...")
    try:
        analysis = await get_analysis(user_id, None, db)
        # Inspect structure since .hotels failed
        print(f"✅ get_analysis success. Keys: {vars(analysis).keys() if hasattr(analysis, '__dict__') else 'No __dict__'}")
    except Exception as e:
        print(f"❌ get_analysis FAILED: {e}")
        import traceback
        traceback.print_exc()

    print("3. Testing get_dashboard...")
    try:
        dashboard = await get_dashboard(user_id, db)
        print("✅ get_dashboard success!")
    except Exception as e:
        print(f"❌ get_dashboard FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(diagnose())
