
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
load_dotenv(".env.local", override=True)

def delete_bad_log():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Missing credentials")
        return

    supabase: Client = create_client(url, key)
    
    # Target the specific log 
    # Log ID from previous step: 84718095-d7aa-4b3f-945e-4595b6b1b9ee
    log_id = "84718095-d7aa-4b3f-945e-4595b6b1b9ee"

    print(f"Deleting bad log {log_id}...")
    res = supabase.table("price_logs").delete().eq("id", log_id).execute()
    print("Delete result:", res)
    
    # Also delete any other 1000 TL logs for Hilton just in case
    # (Optional, but safer if there were dupes)
    # Get Hilton ID first...
    hotels = supabase.table('hotels').select('id').ilike('name', '%Hilton%').execute()
    if hotels.data:
        hid = hotels.data[0]['id']
        print(f"Cleaning up any other 1000 TL logs for {hid}...")
        supabase.table("price_logs").delete().eq("hotel_id", hid).eq("price", 1000).execute()

if __name__ == "__main__":
    delete_bad_log()
