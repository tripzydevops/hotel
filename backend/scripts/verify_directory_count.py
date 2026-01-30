
import sys
import os
from dotenv import load_dotenv
from supabase import create_client

# Add project root directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env.local'))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_count():
    try:
        # Get count
        response = supabase.table("hotel_directory").select("id", count="exact").execute()
        count = response.count
        
        # Get sample
        sample = supabase.table("hotel_directory").select("name, location, serp_api_id").limit(5).execute()
        
        print(f"Total Hotels in Directory: {count}")
        print("Sample Hotels:")
        for h in sample.data:
            print(f" - {h['name']} ({h['location']}) [Token: {h['serp_api_id'][:10]}...]")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_count()
