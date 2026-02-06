import asyncio
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Context setup
sys.path.append(os.path.join(os.getcwd(), "backend"))
load_dotenv()
load_dotenv(".env.local", override=True)

from backend.agents.analyst_agent import AnalystAgent

async def test_discovery():
    print("[TEST] Autonomous Discovery Engine...")
    
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("[TEST] Error: Missing Supabase credentials")
        return

    db = create_client(url, key)
    analyst = AnalystAgent(db)
    
    # 1. Find a test hotel (e.g., Swissôtel The Bosphorus or similar)
    res = db.table("hotel_directory").select("*").ilike("name", "%Swissôtel%").limit(1).execute()
    if not res.data:
        # Fallback to any hotel
        res = db.table("hotel_directory").select("*").limit(1).execute()
        
    if not res.data:
        print("[TEST] Error: No hotels found in directory.")
        return
        
    target = res.data[0]
    print(f"\n[TARGET] {target['name']} ({target['location']})")
    print(f"  -> Content: Stars: {target.get('stars')}, Rating: {target.get('rating')}")
    
    # 2. Trigger Discovery
    print("\n[SCAN] Scouting for similar rivals...")
    rivals = await analyst.discover_rivals(target['id'], limit=5)
    
    if not rivals:
        print("[FAIL] No rivals discovered. Check embeddings and match_hotels RPC.")
        return
        
    print(f"\n[RESULTS] Found {len(rivals)} dynamic rivals:")
    for r in rivals:
        match_pct = round(r['similarity'] * 100, 1)
        print(f"  - [{match_pct}% Match] {r['name']} ({r['location']})")
        print(f"    (Stars: {r['stars']}, Rating: {r['rating']})")

    print("\n[VERIFIED] Autonomous Discovery Engine is live! 🦾")

if __name__ == "__main__":
    asyncio.run(test_discovery())
