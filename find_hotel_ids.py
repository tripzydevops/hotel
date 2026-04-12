import asyncio
from backend.utils.db import get_supabase

async def find():
    db = get_supabase(admin=True)
    res = db.table("hotels").select("id, name").ilike("name", "%Willmont%").execute()
    for h in res.data:
        print(f"Hotel Found: {h['name']} -> {h['id']}")

if __name__ == "__main__":
    asyncio.run(find())
