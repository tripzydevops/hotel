import asyncio
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv("/home/successofmentors/.gemini/antigravity/scratch/hotel/.env")

async def get_user_id():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(f"Error: Missing URL ({url}) or Key ({key})")
        return
    supabase = create_client(url, key)
    
    res = supabase.table("user_profiles").select("user_id, email, display_name").limit(10).execute()
    print("Users:")
    for user in res.data:
        print(user)

    # Also check settings for tripzydevops if found
    tripzy = next((u for u in res.data if "tripzy" in (u.get("display_name") or "").lower() or "tripzy" in (u.get("email") or "").lower()), None)
    if tripzy:
        uid = tripzy["user_id"]
        print(f"\nSettings for {uid}:")
        sres = supabase.table("settings").select("*").eq("user_id", uid).execute()
        print(sres.data)
        
        print(f"\nProfiles entry for {uid}:")
        pres = supabase.table("profiles").select("*").eq("id", uid).execute()
        print(pres.data)
        
        print(f"\nScan Sessions for {uid}:")
        sres = supabase.table("scan_sessions").select("*").eq("user_id", uid).order("created_at", desc=True).limit(5).execute()
        for s in sres.data:
            print(f"ID: {s['id']}, Type: {s['session_type']}, Status: {s['status']}, Created: {s['created_at']}")
        
        print(f"\nLast Price Logs for {uid}:")
        # Find hotels first
        hres = supabase.table("hotels").select("id, name").eq("user_id", uid).execute()
        hids = [h["id"] for h in hres.data]
        if hids:
            pres = supabase.table("price_logs").select("*").in_("hotel_id", hids).order("recorded_at", desc=True).limit(5).execute()
            print(pres.data)
        else:
            print("No hotels found for user.")

if __name__ == "__main__":
    asyncio.run(get_user_id())
