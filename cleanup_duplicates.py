import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/tripzydevops/hotel/.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def deduplicate():
    name_pattern = '%Ramada%Residences%By%Wyndham%Balikesir%'
    print(f"Searching for duplicates of '{name_pattern}'...")
    
    res = supabase.table('hotels').select('*').ilike('name', name_pattern).execute()
    
    if len(res.data) <= 1:
        print("No duplicates found.")
        return

    print(f"Found {len(res.data)} records. Identifying the best one to keep...")
    
    # Sort by last_scan desc, then created_at desc
    sorted_hotels = sorted(
        res.data, 
        key=lambda x: (x.get('last_scan') or '', x.get('created_at') or ''), 
        reverse=True
    )
    
    keep = sorted_hotels[0]
    to_delete = sorted_hotels[1:]
    
    print(f"KEEPING: ID {keep['id']} | Last Scan: {keep.get('last_scan')}")
    
    for h in to_delete:
        print(f"DELETING: ID {h['id']} | Last Scan: {h.get('last_scan')}")
        # Delete price logs first if there's no cascade (manual safety)
        # But we'll try direct delete first
        try:
            supabase.table('hotels').delete().eq('id', h['id']).execute()
            print(f"  Successfully deleted {h['id']}")
        except Exception as e:
            print(f"  Failed to delete {h['id']}: {e}")

if __name__ == "__main__":
    asyncio.run(deduplicate())
