
import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def check_database():
    print("--- Database Diagnostics ---")
    
    # 1. Check Users
    users_res = supabase.table("user_profiles").select("user_id, email").execute()
    print(f"\nUsers: {len(users_res.data)}")
    for u in users_res.data[:5]:
        print(f"  - {u['email']} ({u['user_id']})")
    
    if not users_res.data:
        return

    user_id = users_res.data[0]['user_id'] # Use the first user found
    
    # 2. Check Scan Sessions
    sessions_res = supabase.table("scan_sessions").select("*").order("created_at", desc=True).limit(5).execute()
    print(f"\nRecent Sessions: {len(sessions_res.data)}")
    for s in sessions_res.data:
        print(f"  - ID: {s['id']}, Created: {s['created_at']}, Status: {s['status']}")

    # 3. Check Price Logs
    logs_res = supabase.table("price_logs").select("*").order("recorded_at", desc=True).limit(5).execute()
    print(f"\nRecent Price Logs: {len(logs_res.data)}")
    for l in logs_res.data:
        print(f"  - Hotel: {l['hotel_id']}, Match: {l['serp_api_id']}, Date: {l['recorded_at']}, Price: {l['price']} {l['currency']}")

    # 4. Check Alerts
    alerts_res = supabase.table("alerts").select("*").order("created_at", desc=True).limit(5).execute()
    print(f"\nRecent Alerts: {len(alerts_res.data)}")
    for a in alerts_res.data:
        print(f"  - Msg: {a['message']}, Created: {a['created_at']}")

if __name__ == "__main__":
    asyncio.run(check_database())
