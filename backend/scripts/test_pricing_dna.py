
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# Import the process function directly
from backend.scripts.update_pricing_dna import process_hotel

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Credentials missing")
    sys.exit(1)

supabase = create_client(url, key)

async def test_pricing_dna():
    print("Preparing test data...")
    
    # 1. Create Dummy Hotel
    test_id = str(uuid.uuid4())
    print(f"Test Hotel ID: {test_id}")
    
    supabase.table("hotels").insert({
        "id": test_id,
        "name": "Test High Volatility Hotel",
        "user_id": "00000000-0000-0000-0000-000000000000", # Dummy
        "location": "Test City, Test",
        "stars": 4
    }).execute()
    
    # 2. Insert Dummy Price History (15 days)
    # Pattern: high weekend surge
    today = datetime.now().date()
    history_entries = []
    
    for i in range(15):
        d = today - timedelta(days=i)
        is_weekend = d.weekday() >= 5
        price = 150.0 if is_weekend else 100.0
        
        history_entries.append({
            "hotel_id": test_id,
            "date": d.isoformat(),
            "avg_price": price,
            "min_price": price,
            "max_price": price
        })
        
    supabase.table("price_history_daily").insert(history_entries).execute()
    print("Inserted 15 days of price history.")

    try:
        # 3. Run DNA Process
        print("Running DNA generation...")
        await process_hotel(test_id, "Test High Volatility Hotel", min_days=14)
        
        # 4. Verify
        res = supabase.table("hotels").select("pricing_dna").eq("id", test_id).execute()
        dna = res.data[0].get("pricing_dna")
        
        if dna:
            if isinstance(dna, str):
                import json
                dna = json.loads(dna)
            
            print(f"[Success] DNA Generated! Vector size: {len(dna)}")
            if len(dna) != 768:
                print(f"[Error] Unexpected dimension: {len(dna)}")
        else:
            print("[Error] DNA is NULL.")
            
    finally:
        # Cleanup
        print("Cleaning up test data...")
        supabase.table("price_history_daily").delete().eq("hotel_id", test_id).execute()
        supabase.table("hotels").delete().eq("id", test_id).execute()

if __name__ == "__main__":
    asyncio.run(test_pricing_dna())
