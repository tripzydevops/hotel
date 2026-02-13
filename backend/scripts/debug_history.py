import asyncio
import os
import sys
from dotenv import load_dotenv

# Add root to path
sys.path.append(os.getcwd())
# Load .env.local for Next.js/Supabase env vars
load_dotenv(os.path.join(os.getcwd(), '.env.local'))
load_dotenv(os.path.join(os.getcwd(), '.env'))

from backend.utils.db import get_supabase

async def check_history():
    print("Connecting to Supabase...")
    db = get_supabase()
    
    print("\n--- SEARCHING FOR PRICE LOGS WITH RICH DATA ---")
    # Fetch price logs that have room_types or offers (jsonb check is tricky in python client raw, 
    # so we fetch recent ones and filter)
    logs = db.table("price_logs").select("*").order("recorded_at", desc=True).limit(100).execute()
    
    found_any = False
    for log in logs.data:
        offers = log.get("offers")
        rooms = log.get("room_types")
        
        # Check if they are non-empty lists
        has_rich = (isinstance(offers, list) and len(offers) > 0) or (isinstance(rooms, list) and len(rooms) > 0)
        
        if has_rich:
            found_any = True
            print(f"\n[Found Rich Data] Hotel ID: {log['hotel_id']} | Price: {log['price']} | Date: {log['recorded_at']}")
            print(f"Offers: {len(offers) if offers else 0} | Room Types: {len(rooms) if rooms else 0}")
            
            # Find the hotel name
            hotel = db.table("hotels").select("name, location, serp_api_id").eq("id", log['hotel_id']).single().execute()
            h_name = hotel.data['name'] if hotel.data else "Unknown"
            h_loc = hotel.data['location'] if hotel.data else "Unknown"
            h_token = hotel.data.get('serp_api_id') if hotel.data else "None"
            
            print(f"Hotel: {h_name} ({h_loc})")
            print(f"Token in DB: {h_token}")

            # Try to find the query log
            if log.get("session_id"):
                print(f"Session ID: {log['session_id']}")
                q_log = db.table("query_logs").select("*").eq("session_id", log['session_id']).execute()
                if q_log.data:
                    print(f"Associated Query Log(s): {len(q_log.data)}")
                    for q in q_log.data:
                        print(f"  - Action: {q['action_type']} | Status: {q['status']} | Created: {q['created_at']}")
                        print(f"    Check-in: {q.get('check_in_date')} | Adults: {q.get('adults')} | Currency: {q.get('currency')}")
                        print(f"    Hotel: {q.get('hotel_name')} | Vendor: {q.get('vendor')}")
                else:
                    print("No associated query logs found for this session ID.")
            else:
                print("No session_id in price_log.")
    
    if not found_any:
        print("No enriched price logs found in the last 100 entries.")

if __name__ == "__main__":
    asyncio.run(check_history())
