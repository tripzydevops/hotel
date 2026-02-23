import os
import sys
from uuid import UUID
from dotenv import load_dotenv

# Load environment
load_dotenv()
load_dotenv(".env.local", override=True)

# Add project root to path for backend imports
sys.path.append(os.getcwd())

from backend.utils.db import get_supabase

def restore_hotel(hotel_id: str):
    """
    Restores a soft-deleted hotel by setting its deleted_at column to NULL.
    """
    db = get_supabase()
    if not db:
        print("Error: Could not initialize database connection.")
        return

    try:
        # 1. Verify existence and current status
        res = db.table("hotels").select("name, deleted_at").eq("id", hotel_id).execute()
        
        if not res.data:
            print(f"Error: Hotel with ID {hotel_id} not found.")
            return
            
        hotel = res.data[0]
        if hotel.get("deleted_at") is None:
            print(f"Hotel '{hotel['name']}' is already active.")
            return

        # 2. Restore
        print(f"Restoring '{hotel['name']}' (ID: {hotel_id})...")
        update_res = db.table("hotels").update({"deleted_at": None}).eq("id", hotel_id).execute()
        
        if update_res.data:
            print(f"Success! Hotel '{hotel['name']}' has been restored and will now appear in dashboards and scans.")
        else:
            print("Failed to update hotel record.")

    except Exception as e:
        print(f"Error during restoration: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 backend/scripts/restore_hotel.py <hotel_uuid>")
        sys.exit(1)
    
    target_id = sys.argv[1]
    restore_hotel(target_id)
