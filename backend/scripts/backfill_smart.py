import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# Context setup
sys.path.append(os.getcwd())
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found.")
    exit(1)

supabase: Client = create_client(url, key)

async def backfill_from_json():
    print("--- [Source 1] Recovering from rapidapi_debug.json ---")
    json_path = os.path.join(os.getcwd(), "rapidapi_debug.json")
    if not os.path.exists(json_path):
        print("  ! rapidapi_debug.json not found.")
        return 0

    try:
        with open(json_path, "r") as f:
            data = json.load(f)
        
        hotels_data = data.get("data", {}).get("hotels", [])
        if not hotels_data:
            print("  ! No hotel data found in JSON.")
            return 0

        recovered_count = 0
        for item in hotels_data:
            prop = item.get("property", {})
            name = prop.get("name")
            lat = prop.get("latitude")
            lng = prop.get("longitude")

            if name and lat and lng:
                # Find in hotels table
                res = supabase.table("hotels").select("id").ilike("name", f"%{name}%").limit(1).execute()
                if res.data:
                    hotel_id = res.data[0]['id']
                    supabase.table("hotels").update({
                        "latitude": lat,
                        "longitude": lng
                    }).eq("id", hotel_id).execute()
                    print(f"  [RECOVERED] {name} -> {lat}, {lng}")
                    recovered_count += 1
        
        return recovered_count
    except Exception as e:
        print(f"  [ERROR] JSON Recovery failed: {e}")
        return 0

async def backfill_from_traces():
    print("\n--- [Source 2] Recovering from scan_sessions.reasoning_trace ---")
    try:
        # Fetch sessions with traces
        res = supabase.table("scan_sessions").select("id, reasoning_trace").not_.is_("reasoning_trace", "null").execute()
        sessions = res.data or []
        print(f"  Found {len(sessions)} sessions with traces.")

        recovered_count = 0
        for s in sessions:
            trace = s.get("reasoning_trace")
            if not isinstance(trace, list): continue

            for step in trace:
                if not isinstance(step, dict): continue
                meta = step.get("metadata", {})
                # We check if coordinates are in metadata (if my previous self was smart enough)
                # Or if the message contains them
                msg = step.get("message", "")
                
                # ... (Additional extraction logic can be added here if we find patterns)
                # For now, let's look for "latitude" in message or metadata
                if "latitude" in meta:
                    # This implies we logged a rich object
                    pass # Future implementation

        print(f"  Trace recovery: {recovered_count} recovered (Placeholder for now)")
        return recovered_count
    except Exception as e:
        print(f"  [ERROR] Trace Recovery failed: {e}")
        return 0

async def main():
    json_c = await backfill_from_json()
    trace_c = await backfill_from_traces()
    print("\n--- Backfill Summary ---")
    print(f"JSON Recovered: {json_c}")
    print(f"Trace Recovered: {trace_c}")
    print(f"Total: {json_c + trace_c}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
