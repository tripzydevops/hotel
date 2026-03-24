
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import json

load_dotenv()
load_dotenv(".env.local", override=True)

def inspect_1000():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(url, key)
    
    # Get the 1000 TL log
    res = supabase.table("price_logs") \
        .select("*") \
        .eq("price", 1000) \
        .limit(1) \
        .execute()
        
    if res.data:
        entry = res.data[0]
        print(f"--- LOG ENTRY {entry['id']} ---")
        print(f"Recorded At: {entry['recorded_at']}")
        print(f"Check-In: {entry['check_in_date']}")
        print(f"Vendor: {entry['vendor']}")
        print(f"Price: {entry['price']} {entry['currency']}")
        
        print("\n--- PARITY OFFERS ---")
        print(json.dumps(entry.get('parity_offers'), indent=2))
        
        print("\n--- ROOM TYPES (if any) ---")
        print(json.dumps(entry.get('room_types'), indent=2))

if __name__ == "__main__":
    inspect_1000()
