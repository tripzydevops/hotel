import asyncio
from backend.utils.supabase import get_supabase

async def test():
    supabase = get_supabase()
    res = supabase.table("tracked_hotels").select("*").limit(2).execute()
    import pprint
    for h in res.data:
        print("Hotel ID:", h.get("id"))
        print("Room Types:", h.get("room_types") is not None)
        print("Reviews:", h.get("reviews") is not None)
        print("Prices:", h.get("prices") is not None)
        print("Offers/Items in Prices:", h.get("prices", {}).get("items") if h.get("prices") else None)

asyncio.run(test())
