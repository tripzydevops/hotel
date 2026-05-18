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
    print("Fetching session from DB...")
    s_res = s.table('scan_sessions').select('raw_payload').eq('id', session_id).execute()
    if not s_res.data:
        print("Session not found")
        return

    raw_payload = s_res.data[0].get('raw_payload') or []
    print(f"Loaded raw payload with {len(raw_payload)} entries.")

    for entry in raw_payload:
        payload = entry.get('payload') or {}
        tasks = payload.get('tasks') or []
        for t in tasks:
            result = t.get('result') or []
            if result:
                res_obj = result[0]
                keyword = res_obj.get('keyword')
                items = res_obj.get('items') or []
                tag = (t.get('data') or {}).get('tag')
                print(f"Tag: {tag} | Keyword: {keyword} | Items: {len(items)}")

if __name__ == '__main__':
    asyncio.run(main())
