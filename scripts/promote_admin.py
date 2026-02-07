import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env vars
load_dotenv(".env.local", override=True)

def main():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Missing env vars in os.environ")
        # Try to read likely location if not in env
        print("Checking .env.local file directly...")
        try:
            with open(".env.local", "r") as f:
                for line in f:
                    if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                        key = line.split("=", 1)[1].strip().strip('"').strip("'")
        except FileNotFoundError:
            print(".env.local file not found")
            return

    if not url or not key:
        print("Could not find credentials.")
        return

    print(f"Connecting to {url}...")
    try:
        supabase: Client = create_client(url, key)
    except Exception as e:
        print(f"Failed to create client: {e}")
        return

    # Search for user
    print("Searching for 'askin'...")
    try:
        # Search by email
        res = supabase.table("user_profiles").select("*").ilike("email", "%askin%").execute()
        
        users = res.data or []
        
        # Search by display name if no email match
        if not users:
            print("No email match. Searching display_name...")
            res = supabase.table("user_profiles").select("*").ilike("display_name", "%askin%").execute()
            users = res.data or []
            
        if not users:
            # Last resort: list all and filter efficiently in python if small, or just fail
            print("User 'askin' not found via ILIKE.")
            return

        for user in users:
            print(f"Found user: {user.get('email')} (ID: {user['user_id']}) - Role: {user.get('role')}")
            
            if user.get("role") != "admin":
                print("Promoting to admin...")
                update_res = supabase.table("user_profiles").update({"role": "admin"}).eq("user_id", user["user_id"]).execute()
                print(f"Update Result: {update_res.data}")
            else:
                print("User is already admin.")
                
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    main()
