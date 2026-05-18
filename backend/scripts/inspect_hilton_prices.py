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

    session_id = "0bc8f478-70bb-4eb0-b27c-0f53d5587ac2"
    s_res = s.table('scan_sessions').select('*').eq('id', session_id).execute()
    if not s_res.data:
        print("Session not found")
        return

    session = s_res.data[0]
    raw_payload = session.get('raw_payload') or []

    for idx, entry in enumerate(raw_payload):
        ep = entry.get('endpoint')
        payload = entry.get('payload') or {}
        tasks = payload.get('tasks') or []
        for t_idx, t in enumerate(tasks):
            hotel_id_in_data = t.get('data', {}).get('hotel_identifier') or ""
            if "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE" == hotel_id_in_data:
                result = t.get('result') or []
                if result:
                    res_obj = result[0]
                    print(f"[{idx}][{ep}] Hilton Garden Inn:")
                    print(f"  Title: {res_obj.get('title')}")
                    print(f"  Prices raw object: {json.dumps(res_obj.get('prices'), indent=2)}")
                    print(f"  Result top level keys: {list(res_obj.keys())}")
                    return

if __name__ == '__main__':
    asyncio.run(main())
