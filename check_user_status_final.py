
import os
import sys

def load_env_manual(path):
    if not os.path.exists(path):
        return {}
    env = {}
    with open(path, "r") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.strip().split("=", 1)
                env[key] = value.strip("'\"")
    return env

def check_user():
    env = load_env_manual(".env.local")
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    try:
        from supabase import create_client
        db = create_client(url, key)
        user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
        
        print(f"Checking profile for {user_id}...")
        res = db.table("profiles").select("*").eq("id", user_id).execute()
        if res.data:
            print("Profile Data:", res.data[0])
        else:
            print("Profile not found in 'profiles' table.")
            
        print(f"Checking user_profile for {user_id}...")
        res2 = db.table("user_profiles").select("*").eq("user_id", user_id).execute()
        if res2.data:
            print("User Profile Data:", res2.data[0])
        else:
            print("User Profile not found in 'user_profiles' table.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_user()
