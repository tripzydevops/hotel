import asyncio
import os
import sys
import json

sys.path.append(os.getcwd())

from backend.utils.db import get_supabase

async def main():
    s = get_supabase(admin=True)
    if not s:
        print("Failed to connect to DB")
        return

    hotel_id = "5b266b56-106f-4f55-a6d6-9d58a063f155"
    print("Fetching hotel details from DB...")
    res = s.table('hotels').select('*').eq('id', hotel_id).execute()
    if res.data:
        print(json.dumps(res.data[0], indent=2))
    else:
        print("Hotel not found")

    print("\nFetching all hotels in DB to see their names and addresses...")
    res2 = s.table('hotels').select('id, name, address, metadata').execute()
    for h in (res2.data or []):
        print(f"ID: {h['id']} | Name: {h['name']} | Address: {h['address']} | Meta: {h.get('metadata')}")

if __name__ == '__main__':
    asyncio.run(main())
