import asyncio
import os
import sys
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
from dotenv import load_dotenv

load_dotenv(".env.local")

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials in .env.local")
    sys.exit(1)

supabase = create_client(url, key)

async def check_recent_logs():
    print(f"Checking logs for {datetime.now().strftime('%Y-%m-%d')}...")
    
    # 1. Get price logs for Feb 4th
    res = supabase.table("price_logs").select("*").gte("recorded_at", "2026-02-04T00:00:00").order("recorded_at", desc=True).execute()
    logs = res.data or []
    for l in logs:
        print(f"Logged ID: {l.get('hotel_id')} | Price: {l.get('price')} | Recorded: {l.get('recorded_at')}")
    
    if not logs:
        print("No price logs found!")
        return

    print(f"Found {len(logs)} recent logs:")
    for l in logs:
        print(f"Hotel: {l.get('hotel_id')} | Price: {l.get('price')} {l.get('currency')} | Recorded: {l.get('recorded_at')}")

    # 2. Check if there are any logs for today (2026-02-04)
    # 1. Get latest scan session
    s_res = supabase.table("scan_sessions").select("*").order("created_at", desc=True).limit(1).execute()
    if not s_res.data:
        print("No scan sessions found!")
        return
    
    # Get hotel names
    hotels_res = supabase.table("hotels").select("id, name, is_target_hotel").execute()
    hotel_names = {h["id"]: h["name"] for h in hotels_res.data}

    sess = s_res.data[0]
    s_id = sess["id"]
    print(f"\nLatest Session: {s_id} ({sess['session_type']}) at {sess['created_at']}")
    print(f"Status: {sess['status']} | Hotels: {sess['hotels_count']}")

    # 2. Get Query Logs for this session
    q_res = supabase.table("query_logs").select("*").eq("session_id", s_id).execute()
    print(f"\nQuery Logs for this session ({len(q_res.data)}):")
    for q in q_res.data:
        print(f"  - {q.get('hotel_name')}: Status={q.get('status')} | Price={q.get('price')}")

    # 3. Get Price Logs for this session
    # We can't directly filter price_logs by session_id (no column), but we can check recorded_at close to session created_at
    print(f"\nPrice Logs created around {sess['created_at']}:")
    p_res = supabase.table("price_logs").select("*").gte("recorded_at", sess["created_at"]).execute()
    for p in (p_res.data or []):
        name = hotel_names.get(p.get('hotel_id'), 'Unknown')
        print(f"  - {name}: Price={p.get('price')} | Recorded: {p.get('recorded_at')}")

if __name__ == "__main__":
    asyncio.run(check_recent_logs())
