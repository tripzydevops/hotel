
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diag_user_data_fixed():
    # 1. Start from Ramada Residences
    ramada_id = "838f4714-4cfa-4ff7-bad2-67f3960667bf"
    r_res = supabase.table("hotels").select("*").eq("id", ramada_id).execute()
    if not r_res.data:
        print("Hotel not found")
        return
    
    hotel_name = r_res.data[0]["name"]
    user_id = r_res.data[0]["user_id"]
    print(f"Target Hotel: {hotel_name} (ID: {ramada_id})")
    print(f"Target User ID: {user_id}")
    
    # 2. Check query_logs for this hotel (Legacy Data) - Match by name
    print(f"\n--- Checking LEGACY query_logs for '{hotel_name}' ---")
    q_res = supabase.table("query_logs") \
        .select("count", count="exact") \
        .ilike("hotel_name", f"%{hotel_name}%") \
        .execute()
    print(f"Legacy Query Logs Count: {q_res.count}")
    
    if q_res.count > 0:
        q_data = supabase.table("query_logs").select("*").ilike("hotel_name", f"%{hotel_name}%").limit(10).execute()
        for q in q_data.data:
            print(f"  Legacy Log: {q['created_at']} | Price: {q['price']} | Check-in: {q.get('check_in_date')}")

    # 3. Check price_logs for ANY hotel of this user
    h_all = supabase.table("hotels").select("*").eq("user_id", user_id).execute()
    print(f"\n--- Price Logs status for all user hotels ---")
    for h in h_all.data:
        hid = h["id"]
        p_res = supabase.table("price_logs").select("count", count="exact").eq("hotel_id", hid).execute()
        print(f"  {h['name']}: {p_res.count} logs")

if __name__ == "__main__":
    asyncio.run(diag_user_data_fixed())
