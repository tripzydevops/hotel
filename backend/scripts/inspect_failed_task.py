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

    # Task ID we want to inspect:
    # 6c96f2d3-9ec9-4846-a1cf-836e4c686e50 (ext task id: 05181234-1419-0290-0000-972018228768)
    task_id = "6c96f2d3-9ec9-4846-a1cf-836e4c686e50"
    ext_task_id = "05181234-1419-0290-0000-972018228768"
    session_id = "0bc8f478-70bb-4eb0-b27c-0f53d5587ac2"

    print("Fetching scan task from DB...")
    t_res = s.table('scan_tasks').select('*').eq('id', task_id).execute()
    if t_res.data:
        print("Scan task details:")
        print(json.dumps(t_res.data[0], indent=2))
    else:
        print("Task not found")

    print("\nFetching session from DB...")
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
            if t.get('id') == ext_task_id or (t.get('data') or {}).get('tag') == task_id:
                print("\n=== MATCHING TASK RAW PAYLOAD ===")
                print(f"Status Code: {t.get('status_code')}")
                print(f"Status Message: {t.get('status_message')}")
                result = t.get('result') or []
                print(f"Result count: {len(result)}")
                if result:
                    res_obj = result[0]
                    print(f"Result keys: {list(res_obj.keys())}")
                    items = res_obj.get('items') or []
                    print(f"Items count: {len(items)}")
                    if items:
                        print("First item preview:")
                        print(json.dumps(items[0], indent=2)[:1000])
                    else:
                        print("Items is empty.")
                        # Check what other keys might be present
                        for k, v in res_obj.items():
                            if k != 'items':
                                val_str = str(v)
                                if len(val_str) > 200:
                                    val_str = val_str[:200] + "..."
                                print(f"  {k}: {val_str}")
                return

if __name__ == '__main__':
    asyncio.run(main())
