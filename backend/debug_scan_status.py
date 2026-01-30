
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_recent_sessions():
    print("\n--- Recent Scan Sessions ---")
    res = supabase.table("scan_sessions").select("*").order("created_at", desc=True).limit(5).execute()
    for s in res.data:
        print(f"ID: {s['id']} | Status: {s['status']} | Hotels: {s.get('hotels_count')} | Created: {s['created_at']}")

def check_query_logs(session_id=None):
    print("\n--- Recent Query Logs ---")
    query = supabase.table("query_logs").select("*").order("created_at", desc=True)
    if session_id:
        query = query.eq("session_id", session_id)
    res = query.limit(10).execute()
    for l in res.data:
        print(f"Session: {l.get('session_id')} | Hotel: {l.get('hotel_name')} | Action: {l.get('action_type')} | Status: {l.get('status')} | Price: {l.get('price')} {l.get('currency')}")

def check_api_keys():
    print("\n--- API Key Status (from env) ---")
    primary = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
    print(f"Primary Key: {'Set' if primary else 'Missing'}")
    for i in range(2, 11):
        key = os.getenv(f"SERPAPI_API_KEY_{i}")
        if key:
            print(f"Key {i}: Set")

if __name__ == "__main__":
    check_recent_sessions()
    check_query_logs()
    check_api_keys()
