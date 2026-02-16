import os
from supabase import create_client
from backend.services.analysis_service import get_price_for_room

# Setup Supabase
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

def debug_ramada():
    print("Searching for Ramada...")
    res = supabase.table("hotels").select("id, name").ilike("name", "%RAMADA%").execute()
    hotels = res.data or []
    
    if not hotels:
        print("No Ramada hotel found.")
        return

    target_hotel = hotels[0]
    print(f"Found hotel: {target_hotel['name']} (ID: {target_hotel['id']})")
    
    # Fetch latest price log
    print("Fetching latest price log...")
    log_res = supabase.table("price_logs").select("*").eq("hotel_id", target_hotel['id']).order("recorded_at", desc=True).limit(1).execute()
    logs = log_res.data or []
    
    if not logs:
        print("No price logs found.")
        return

    latest_log = logs[0]
    print(f"Latest Log Room Types: {latest_log.get('room_types')}")
    
    # Test get_price_for_room with "Standard"
    print("\nTesting 'Standard' match:")
    price, name, score = get_price_for_room(latest_log, "Standard", {})
    print(f"Result: Price={price}, Name={name}, Score={score}")
    
    # Test "All Room Types"
    print("\nTesting 'All Room Types' match:")
    price_all, name_all, score_all = get_price_for_room(latest_log, "All Room Types", {})
    print(f"Result: Price={price_all}, Name={name_all}, Score={score_all}")

    if price_all is None:
        print("FAIL: 'All Room Types' failed to find price (Strict filtering blocked it?)")
    else:
        print("PASS: 'All Room Types' found price.")

if __name__ == "__main__":
    debug_ramada()
