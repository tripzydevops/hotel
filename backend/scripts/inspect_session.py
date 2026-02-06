
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found.")
    exit(1)

supabase: Client = create_client(url, key)

def inspect_session(session_prefix):
    print(f"--- Inspecting Session starting with {session_prefix} ---")
    
    # Fetch session
    # We can't do LIKE on UUID fields easily in all Supabase versions via client, 
    # but let's try to list recent sessions and find it.
    res = supabase.table("scan_sessions").select("*").order("created_at", desc=True).limit(20).execute()
    
    target_session = None
    for s in res.data:
        if str(s["id"]).startswith(session_prefix):
            target_session = s
            break
            
    if not target_session:
        print(f"Session {session_prefix}... not found in last 20 sessions.")
        print("Last 5 session IDs:")
        for s in res.data[:5]:
            print(f" - {s['id']} ({s['status']})")
        return

    print(f"FOUND SESSION: {target_session['id']}")
    print(f"Status: {target_session.get('status')}")
    print(f"Created: {target_session.get('created_at')}")
    print(f"Completed: {target_session.get('completed_at')}")
    print(f"User ID: {target_session.get('user_id')}")
    print(f"Hotels Count: {target_session.get('hotels_count')}")
    
    # Check Query Logs for this session
    print("\n--- Query Logs for Session ---")
    logs = supabase.table("query_logs").select("*").eq("session_id", target_session["id"]).execute()
    if logs.data:
        for l in logs.data:
            print(f"[{l['created_at']}] {l['hotel_name']} -> Status: {l['status']} | Price: {l.get('price')}")
    else:
        print("No query logs found for this session ID.")

    # Check Recent Price Logs for this User (General check for today)
    print("\n--- Recent Price Logs (Today) ---")
    user_id = target_session["user_id"]
    try:
        # Get IDs involved
        price_logs = supabase.table("price_logs") \
            .select("recorded_at, price, hotel_id, check_in_date") \
            .order("recorded_at", desc=True) \
            .limit(10) \
            .execute()
        
        hotel_ids = list(set([p['hotel_id'] for p in price_logs.data]))
        # Fetch hotel names
        hotels_map = {}
        if hotel_ids:
            h_res = supabase.table("hotels").select("id, name").in_("id", hotel_ids).execute()
            for h in h_res.data:
                hotels_map[h['id']] = h['name']

        for p in price_logs.data:
            h_name = hotels_map.get(p['hotel_id'], "Unknown ID")
            print(f"[{p['recorded_at']}] {h_name} ({p['hotel_id']}) -> {p['price']} | In: {p.get('check_in_date')}")
            
    except Exception as e:
        print(f"Error checking price logs: {e}")

    # Check Columns of scan_sessions
    print("\n--- Scan Session Columns ---")
    try:
        cols = supabase.table("scan_sessions").select("*").limit(1).execute()
        if cols.data:
            print(cols.data[0].keys())
    except: pass
    
    # Check Columns of query_logs
    print("\n--- Query Logs Columns ---")
    try:
        cols = supabase.table("query_logs").select("*").limit(1).execute()
        if cols.data:
            print(cols.data[0].keys())
    except: pass

if __name__ == "__main__":
    inspect_session("07edc183")
