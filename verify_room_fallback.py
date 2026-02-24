
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Add project root to path
import sys
sys.path.append(os.getcwd())

load_dotenv(".env.local")

from backend.services.analysis_service import get_market_intelligence_data

async def verify_room_mismatch_fix():
    print("\n--- Verifying Room Type Fallback Fix ---")
    user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
    
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(url, key)
    
    print("Calling get_market_intelligence_data for 'deluxe'...")
    res = await get_market_intelligence_data(
        user_id=user_id,
        room_type="deluxe",
        db=supabase
    )
    
    # daily_prices is a list of dicts with 'date', 'target', 'competitors' etc.
    daily_prices = res.get("daily_prices", [])
    print(f"Got {len(daily_prices)} daily price entries.")
    
    # Check a few entries for Standard leakage
    ramada_leaks = 0
    ramada_correct = 0
    for entry in daily_prices[:10]:
        d = entry.get("date", "?")
        target = entry.get("target")
        target_name = entry.get("target_room_name", "")
        
        # Check competitors for Ramada
        for comp in entry.get("competitors", []):
            if "Ramada" in comp.get("name", ""):
                p = comp.get("price")
                room = comp.get("matched_room", "")
                if p is not None and ("Standard" in str(room) or "Legacy" in str(room)):
                    ramada_leaks += 1
                    print(f"  LEAK on {d}: Ramada Deluxe → {p} ({room})")
                elif p is None:
                    ramada_correct += 1
                    print(f"  OK on {d}: Ramada Deluxe → N/A (correctly rejected)")
                else:
                    ramada_correct += 1
                    print(f"  OK on {d}: Ramada Deluxe → {p} ({room})")
    
    if ramada_leaks > 0:
        print(f"\nFAIL: {ramada_leaks} Standard price leaks into Deluxe view.")
    else:
        print(f"\nSUCCESS: No Standard price leaks. {ramada_correct} correct entries found.")

if __name__ == "__main__":
    asyncio.run(verify_room_mismatch_fix())
