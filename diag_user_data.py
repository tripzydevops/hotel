
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def diag_user_data():
    # 1. Start from Ramada Residences
    ramada_id = "838f4714-4cfa-4ff7-bad2-67f3960667bf"
    r_res = supabase.table("hotels").select("*").eq("id", ramada_id).execute()
    if not r_res.data:
        print("Hotel not found")
        return
    
    user_id = r_res.data[0]["user_id"]
    print(f"Target User ID: {user_id}")
    
    # 2. Get all hotels for this user
    h_res = supabase.table("hotels").select("*").eq("user_id", user_id).execute()
    hotels = h_res.data or []
    print(f"\nHotels for this user ({len(hotels)}):")
    for h in hotels:
        print(f"- {h['name']} (ID: {h['id']}, Target: {h.get('is_target_hotel')})")

    # 3. Check query_logs for this user/hotel (Legacy Data)
    print(f"\n--- Checking LEGACY query_logs for Ramada ---")
    q_res = supabase.table("query_logs") \
        .select("count", count="exact") \
        .eq("hotel_id", ramada_id) \
        .execute()
    print(f"Legacy Query Logs Count: {q_res.count}")
    
    if q_res.count > 0:
        q_data = supabase.table("query_logs").select("*").eq("hotel_id", ramada_id).limit(5).execute()
        for q in q_data.data:
            print(f"  Legacy Log: {q['recorded_at']} | Price: {q['price']}")

    # 4. Check price_logs for ANY hotel of this user
    print(f"\n--- Price Logs status for all user hotels ---")
    for h in hotels:
        hid = h["id"]
        p_res = supabase.table("price_logs").select("count", count="exact").eq("hotel_id", hid).execute()
        print(f"  {h['name']}: {p_res.count} logs")

if __name__ == "__main__":
    asyncio.run(diag_user_data())
