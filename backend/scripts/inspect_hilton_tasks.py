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
    print("Fetching session...")
    s_res = s.table('scan_sessions').select('*').eq('id', session_id).execute()
    if not s_res.data:
        print("Session not found")
        return

    session = s_res.data[0]
    raw_payload = session.get('raw_payload') or []
    print(f"Loaded raw payload with {len(raw_payload)} entries.")

    for idx, entry in enumerate(raw_payload):
        ep = entry.get('endpoint')
        payload = entry.get('payload') or {}
        tasks = payload.get('tasks') or []
        for t_idx, t in enumerate(tasks):
            keyword = t.get('data', {}).get('keyword') or ""
            hotel_id_in_data = t.get('data', {}).get('hotel_identifier') or ""
            if "Hilton" in keyword or "ChkI" in hotel_id_in_data or "ChoI" in hotel_id_in_data:
                status_code = t.get('status_code')
                status_message = t.get('status_message')
                tag = t.get('data', {}).get('tag')
                result = t.get('result') or []
                res_count = len(result)
                items_count = 0
                if result:
                    items = result[0].get('items') or []
                    items_count = len(items)
                print(f"[{idx}][{ep}] Task ID: {t.get('id')} | Status: {status_code} ({status_message}) | Tag: {tag} | Keyword: '{keyword}' | HotelID: '{hotel_id_in_data}' | Res Count: {res_count} | Items Count: {items_count}")
                if items_count > 0:
                    for i_idx, item in enumerate(items[:5]):
                        print(f"   Item {i_idx}: title='{item.get('title')}' type='{item.get('type')}' hotel_id='{item.get('hotel_identifier')}' prices_count={len(item.get('prices', {}).get('candidates', []) if item.get('prices') else [])}")
                elif result:
                    # Let's see what is inside result[0]
                    res_keys = list(result[0].keys())
                    print(f"   Result[0] keys: {res_keys}")
                    if 'prices' in result[0]:
                        print(f"   Direct prices count: {len(result[0].get('prices', {}).get('candidates', []) or [])}")
                    if 'title' in result[0]:
                        print(f"   Direct title: '{result[0].get('title')}' | hotel_id: '{result[0].get('hotel_identifier')}'")

if __name__ == '__main__':
    asyncio.run(main())
