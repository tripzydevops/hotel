
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing credentials")
    exit(1)

supabase: Client = create_client(url, key)

# The user email from the screenshot
TARGET_EMAIL = "tripzydevops@gmail.com"

async def check_profile():
    print(f"Checking for user: {TARGET_EMAIL}")
    
    # 1. Get User ID from Auth
    # Note: admin auth client needed usually, or we just search if possible. 
    # Supabase-py admin commands:
    try:
        # List users (limit 100) and find the email
        # This is a bit hacky if we don't have list_users permission, but let's try
        # actually, let's just assume we can't easily search auth.users without admin api wrapper
        # Let's try to find them in the tables directly if possible? 
        # No, tables rely on ID.
        
        # Let's try to just query tables for 'email' column if it exists?
        print("--- Checking 'profiles' table for email ---")
        try:
            res = supabase.table("profiles").select("*").eq("email", TARGET_EMAIL).execute()
            print(f"Profiles (by email): {res.data}")
            if res.data:
                print(f"FOUND IN profiles! ID: {res.data[0].get('id')}")
        except Exception as e:
            print(f"Error querying profiles by email: {e}")

        print("--- Checking 'user_profiles' table for email ---")
        try:
            res = supabase.table("user_profiles").select("*").eq("email", TARGET_EMAIL).execute()
            print(f"User Profiles (by email): {res.data}")
            if res.data:
                print(f"FOUND IN user_profiles! ID: {res.data[0].get('user_id')}")
        except Exception as e:
            print(f"Error querying user_profiles by email: {e}")
            
    except Exception as e:
        print(f"General Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_profile())
