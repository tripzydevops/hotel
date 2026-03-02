import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/tripzydevops/hotel/.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def deep_scan():
    print("Searching for ALL hotels matching 'Ramada'...")
    hotels = supabase.table('hotels').select('*').ilike('name', '%Ramada%').execute()
    
    for h in hotels.data:
        print(f"\n--- Hotel: {h['name']} ---")
        print(f"ID: {h['id']}")
        print(f"Current Price: {h.get('current_price')} {h.get('preferred_currency', 'TRY')}")
        print(f"Last Scan: {h.get('last_scan')}")
        
        # Check logs for this hotel
        logs = supabase.table('price_logs').select('*').eq('hotel_id', h['id']).order('recorded_at', desc=True).limit(3).execute()
        for l in logs.data:
            print(f"  Log Date: {l['recorded_at']} | Price: {l['price']} | Check-in: {l.get('check_in_date')} | Source: {l.get('source')}")

    print("\n--- Searching Scan Sessions ---")
    sessions = supabase.table('scan_sessions').select('*').order('created_at', desc=True).limit(5).execute()
    for s in sessions.data:
        print(f"Session ID: {s['id']} | Status: {s['status']} | Created: {s['created_at']} | Type: {s['session_type']}")

if __name__ == "__main__":
    asyncio.run(deep_scan())
