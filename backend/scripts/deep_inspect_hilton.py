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
    print(f"Loaded raw payload with {len(raw_payload)} entries.")

    for idx, entry in enumerate(raw_payload):
        ep = entry.get('endpoint')
        payload = entry.get('payload') or {}
        tasks = payload.get('tasks') or []
        for t_idx, t in enumerate(tasks):
            keyword = t.get('data', {}).get('keyword') or ""
            hotel_id_in_data = t.get('data', {}).get('hotel_identifier') or ""
            if "Hilton" in keyword or "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE" == hotel_id_in_data:
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
                if result:
                    # Let's inspect the keys and prices!
                    res_obj = result[0]
                    if 'prices' in res_obj:
                        p = res_obj.get('prices') or {}
                        print(f"   Prices keys: {list(p.keys())}")
                        candidates = p.get('candidates') or []
                        print(f"   Candidates count: {len(candidates)}")
                        for c_idx, cand in enumerate(candidates[:3]):
                            print(f"     Cand {c_idx}: price={cand.get('price')} source='{cand.get('source')}'")
                    if items:
                        print(f"   Items found: {len(items)}")
                        for i_idx, item in enumerate(items[:3]):
                            print(f"     Item {i_idx}: title='{item.get('title')}' hotel_identifier='{item.get('hotel_identifier')}'")
                            if 'prices' in item:
                                p = item.get('prices') or {}
                                candidates = p.get('candidates') or []
                                print(f"       Candidates count: {len(candidates)}")

if __name__ == '__main__':
    asyncio.run(main())
