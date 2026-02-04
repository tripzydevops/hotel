import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(os.path.join(os.getcwd(), '.env.local'))
load_dotenv(os.path.join(os.getcwd(), '.env'))

from backend.main import get_supabase

async def check_history_deep():
    db = get_supabase()
    
    # We want successful price logs with offers from HG Inn
    # HG Inn ID: 71939ca7-22e1-48f6-a099-47a4269f68f1
    print("\n--- FINDING HG INN SUCCESSFUL LOGS ---")
    logs = db.table("price_logs") \
        .select("*") \
        .eq("hotel_id", "71939ca7-22e1-48f6-a099-47a4269f68f1") \
        .order("recorded_at", desc=True) \
        .limit(20) \
        .execute()
    
    for log in logs.data:
        offers = log.get("offers")
        if isinstance(offers, list) and len(offers) > 0:
            print(f"\n[HG INN RICH] Date: {log['recorded_at']} | Price: {log['price']} | Offers: {len(offers)}")
            print(f"Check-in in log: {log['check_in_date']}")
            
            if log.get("session_id"):
                q_res = db.table("query_logs").select("*").eq("session_id", log['session_id']).execute()
                for q in q_res.data:
                    if q['hotel_name'].lower().startswith("hilton"):
                        print(f"  Query: {q['hotel_name']} | Status: {q['status']}")
                        print(f"  Params: Check-in={q.get('check_in_date')}, Adults={q.get('adults')}")

if __name__ == "__main__":
    asyncio.run(check_history_deep())
