
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def check_competitors():
    user_id = "d33fc277-7006-468f-91b6-8cc7897fd910"
    h_res = supabase.table("hotels").select("*").eq("user_id", user_id).execute()
    hotels = h_res.data or []
    
    print(f"--- Checking legacy logs for all {len(hotels)} hotels of user {user_id} ---")
    for h in hotels:
        name = h["name"]
        hid = h["id"]
        print(f"\nHotel: {name} ({hid})")
        
        # Legacy check
        q_res = supabase.table("query_logs").select("count", count="exact").ilike("hotel_name", f"%{name}%").execute()
        print(f"  Legacy records found: {q_res.count}")
        
        # Current check
        p_res = supabase.table("price_logs").select("count", count="exact").eq("hotel_id", hid).execute()
        print(f"  Current price_logs: {p_res.count}")

if __name__ == "__main__":
    asyncio.run(check_competitors())
