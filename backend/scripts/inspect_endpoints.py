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
    s_res = s.table('scan_sessions').select('*').eq('id', session_id).execute()
    if not s_res.data:
        print("Session not found")
        return

    session = s_res.data[0]
    print(f"Session state: {session.get('status')}")
    print(f"Session error: {session.get('error_message')}")
    
    raw_payload = session.get('raw_payload') or []
    print(f"Loaded raw payload with {len(raw_payload)} entries.")

    for idx, entry in enumerate(raw_payload):
        ep = entry.get('endpoint')
        payload = entry.get('payload') or {}
        tasks = payload.get('tasks') or []
        for t_idx, t in enumerate(tasks):
            t_id = t.get('id')
            status_code = t.get('status_code')
            status_message = t.get('status_message')
            tag = t.get('data', {}).get('tag')
            keyword = t.get('data', {}).get('keyword')
            result = t.get('result') or []
            res_count = len(result)
            items_count = 0
            if result:
                items = result[0].get('items') or []
                items_count = len(items)
            print(f"[{idx}][{ep}] Task: {t_id} | Status: {status_code} ({status_message}) | Tag: {tag} | Keyword: {keyword} | Res Count: {res_count} | Items Count: {items_count}")
            if items_count > 0:
                print(f"  -> Found {items_count} items! First title: {items[0].get('title')}")

if __name__ == '__main__':
    asyncio.run(main())
