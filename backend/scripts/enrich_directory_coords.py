import json
import os
import asyncio
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")

# DataForSEO Credentials
LOGIN = os.getenv("DATAFORSEO_LOGIN")
PASSWORD = os.getenv("DATAFORSEO_PASSWORD")
API_URL = "https://api.dataforseo.com/v3"

# InsForge Credentials
INSFORGE_URL = os.getenv("INSFORGE_GATEWAY", "https://tripzy.ams3.insforge.app")
INSFORGE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

async def submit_batch(client, batch_data):
    """Submits a batch of 100 tasks to DataForSEO."""
    auth = (LOGIN, PASSWORD)
    async with httpx.AsyncClient(auth=auth, timeout=60.0) as df_client:
        url = f"{API_URL}/business_data/google/hotel_info/task_post"
        resp = await df_client.post(url, json=batch_data)
        if resp.status_code != 200:
            print(f"❌ Failed to submit batch: {resp.text}")
            return None
        
        data = resp.json()
        if data.get("status_code") not in [20000, 20100]:
            print(f"❌ DataForSEO Error: {data.get('status_message')}")
            return None
        
        return data["tasks"][0]["id"]

async def fetch_results(task_id):
    """Wait and fetch results for a specific task_id."""
    auth = (LOGIN, PASSWORD)
    async with httpx.AsyncClient(auth=auth, timeout=60.0) as df_client:
        url = f"{API_URL}/business_data/google/hotel_info/task_get/advanced/{task_id}"
        
        max_retries = 10
        for i in range(max_retries):
            resp = await df_client.get(url)
            if resp.status_code != 200:
                print(f"⚠️ Retry {i+1}: Task {task_id} not ready (HTTP {resp.status_code})")
                await asyncio.sleep(10)
                continue
            
            data = resp.json()
            task_info = data.get("tasks", [])[0]
            if task_info.get("status_code") == 20000:
                return task_info.get("result", [])
            
            print(f"⏳ Task {task_id} in progress... (Status: {task_info.get('status_message')})")
            await asyncio.sleep(10)
            
    return None

async def enrich_coords():
    headers = {"apikey": INSFORGE_ANON_KEY, "Authorization": f"Bearer {INSFORGE_ANON_KEY}"}
    
    async with httpx.AsyncClient(base_url=INSFORGE_URL, headers=headers) as ins_client:
        # Fetch hotels missing coordinates but having a verified location_code
        # Wait, the plan says "identify hotels without coordinates".
        # It doesn't strictly require location_code, but usually hotel_info needs it for context.
        print("🔍 Fetching hotels missing coordinates...")
        resp = await ins_client.get("/rest/v1/hotel_directory?select=id,name,property_token,location_code,resolved_location_name&latitude=is.null")
        if resp.status_code != 200:
            print(f"❌ Failed to fetch hotels: {resp.text}")
            return
        
        hotels = resp.json()
        print(f"📊 Found {len(hotels)} hotels to enrich.")

        # Filter for hotels that have a valid identifier (property_token)
        valid_hotels = [h for h in hotels if h.get("property_token")]
        print(f"✅ {len(valid_hotels)} hotels have property_tokens and can be processed.")

        # Process in batches of 100
        for i in range(0, len(valid_hotels), 100):
            batch = valid_hotels[i:i+100]
            print(f"🚀 Processing batch {i//100 + 1} ({len(batch)} hotels)...")

            batch_payload = []
            hotel_map = {} # To match results back to IDs
            
            for h in batch:
                # payload format from test script: 
                # {"hotel_identifier": token, "location_name": name, "language_name": "English"}
                payload = {
                    "hotel_identifier": h["property_token"],
                    "location_name": h.get("resolved_location_name", "Turkiye"),
                    "language_name": "English"
                }
                batch_payload.append(payload)
                # Map by token for result matching (Note: multiple hotels might have same token if duplicates exist)
                hotel_map[h["property_token"]] = h["id"]

            task_id = await submit_batch(ins_client, batch_payload)
            if not task_id:
                continue

            print(f"📍 Task ID: {task_id}. Waiting for results...")
            results = await fetch_results(task_id)
            
            if not results:
                print(f"⚠️ No results for Task {task_id}")
                continue

            # Update hotels with results
            update_count = 0
            for res_item in results:
                # Results usually contain the original task data for matching
                # and the found hotel data.
                found_hotel = res_item.get("items", [])[0] if res_item.get("items") else None
                if not found_hotel:
                    continue
                
                # In Bulk tasks, we need to match back to our local ID.
                # Usually DataForSEO returns our original payload in the response.
                # We'll try to match by property_token.
                token = res_item.get("hotel_identifier")
                target_id = hotel_map.get(token)
                
                if target_id and found_hotel.get("latitude"):
                    u_resp = await ins_client.patch(
                        f"/rest/v1/hotel_directory?id=eq.{target_id}",
                        json={
                            "latitude": found_hotel["latitude"],
                            "longitude": found_hotel["longitude"],
                            "address": found_hotel.get("address"),
                            "phone": found_hotel.get("phone_number")
                        }
                    )
                    if u_resp.status_code in [200, 201, 204]:
                        update_count += 1

            print(f"✅ Batch complete. Updated {update_count} hotels.")

if __name__ == "__main__":
    if not LOGIN or not PASSWORD:
        print("❌ Missing DataForSEO credentials.")
    else:
        asyncio.run(enrich_coords())
