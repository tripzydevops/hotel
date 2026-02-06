
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local", override=True)

async def test_minimal():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    print(f"URL: {url}")
    print(f"Key identified: {'Yes' if key else 'No'}")
    
    if not url or not key:
        return

    print("Connecting to Supabase...")
    try:
        db = create_client(url, key)
        print("Client created.")
        
        print("Fetching one user profile...")
        res = db.table("user_profiles").select("user_id").limit(1).execute()
        print(f"Result received: {len(res.data) if res.data else 0} users found.")
        
        if res.data:
            uid = res.data[0]["user_id"]
            print(f"Verifying settings for user: {uid}")
            s_res = db.table("settings").select("*").eq("user_id", uid).execute()
            print(f"Settings found: {len(s_res.data) if s_res.data else 0}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_minimal())
