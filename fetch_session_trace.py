import os
import asyncio
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/tripzydevops/hotel/.env.local')

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def check_session_trace(session_id):
    print(f"Fetching trace for session: {session_id}")
    res = supabase.table('scan_sessions').select('reasoning_trace').eq('id', session_id).execute()
    
    if not res.data:
        print("Session not found.")
        return

    trace = res.data[0].get('reasoning_trace')
    if not trace:
        print("No reasoning trace found.")
        return

    print("\n--- Reasoning Trace (Raw) ---")
    print(json.dumps(trace, indent=2))
    
    print("\n--- Reasoning Trace (Parsed) ---")
    for step in trace:
        if isinstance(step, str):
            try:
                step_obj = json.loads(step)
                level = step_obj.get('level', 'info').upper()
                msg = step_obj.get('message', '')
                print(f"[{level}] {step_obj.get('step')}: {msg}")
            except:
                print(f"[INFO] RAW: {step}")
        elif isinstance(step, dict):
            level = step.get('level', 'info').upper()
            msg = step.get('message', '')
            print(f"[{level}] {step.get('step')}: {msg}")

if __name__ == "__main__":
    asyncio.run(check_session_trace('050f0018-c302-46db-b5f9-0c43ba0ff36d'))
