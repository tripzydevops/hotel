
import asyncio
import sys
import os
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Context setup
sys.path.append(os.path.join(os.getcwd(), "backend"))
load_dotenv()
load_dotenv(".env.local", override=True)

from supabase import create_client

def verify_persistence():
    print("[TEST] Verifying Rich Data Persistence...")
    
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("[FAIL] Missing Supabase Credentials")
        return

    db = create_client(url, key)
    
    # 1. Test Hotel Amenities & Images
    test_hotel_id = str(uuid.uuid4())
    test_user_id = "00000000-0000-0000-0000-000000000000" # Dummy or valid UUID
    
    print(f"  -> Inserting Test Hotel ({test_hotel_id})...")
    
    rich_amenities = ["Pool", "WiFi", "Spa"]
    rich_images = [{"url": "http://test.com/img1.jpg", "caption": "Lobby"}]
    
    try:
        # Try inserting with new fields
        res = db.table("hotels").insert({
            "id": test_hotel_id,
            "user_id": test_user_id,
            "name": "Rich Data Test Hotel",
            "amenities": rich_amenities,
            "images": rich_images,
            "created_at": datetime.now().isoformat()
        }).execute()
        
        # Read back
        stored = db.table("hotels").select("*").eq("id", test_hotel_id).single().execute()
        data = stored.data
        
        if data.get("amenities") == rich_amenities and data.get("images") == rich_images:
             print("[PASS] Hotel Amenities & Images saved and retrieved correctly.")
             print(f"     -> Stored: {len(data['amenities'])} amenities, {len(data['images'])} images")
        else:
             print("[FAIL] Hotel data mismatch.")
             print(f"     -> Expected: {rich_amenities}")
             print(f"     -> Got: {data.get('amenities')}")

    except Exception as e:
        print(f"[FAIL] Hotel Insert Failed: {e}")
        print("  (Did you run the SQL migration?)")
        
    # 2. Test PriceLog Offers
    print(f"  -> Inserting Test Price Log...")
    rich_offers = [{"vendor": "Expedia", "price": 99}, {"vendor": "Booking", "price": 105}]
    
    try:
        res = db.table("price_logs").insert({
            "hotel_id": test_hotel_id,
            "price": 100,
            "currency": "USD",
            "recorded_at": datetime.now().isoformat(),
            "offers": rich_offers
        }).execute()
        
        # Read back (latest)
        stored = db.table("price_logs").select("*").eq("hotel_id", test_hotel_id).order("recorded_at", desc=True).limit(1).execute()
        data = stored.data[0]
        
        if data.get("offers") == rich_offers:
             print("[PASS] Price Log Offers saved and retrieved correctly.")
             print(f"     -> Stored: {len(data['offers'])} offers")
        else:
             print("[FAIL] Price Log data mismatch.")
             
    except Exception as e:
        print(f"[FAIL] Price Log Insert Failed: {e}")

    # Cleanup
    print("  -> Cleaning up test data...")
    db.table("price_logs").delete().eq("hotel_id", test_hotel_id).execute()
    db.table("hotels").delete().eq("id", test_hotel_id).execute()
    print("[DONE] Cleanup complete.")

if __name__ == "__main__":
    verify_persistence()
