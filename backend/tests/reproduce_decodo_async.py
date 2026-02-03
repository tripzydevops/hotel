import asyncio
import os
import json
import httpx
from datetime import date, timedelta
from dotenv import load_dotenv

# Load envs
load_dotenv()
load_dotenv(".env.local", override=True)

async def test_decodo_async():
    print("--- Decodo Async Test ---")
    
    # Use the token user provided previously if env is missing or generic
    token = "VTAwMDAzNTA0OTE6UFdfMTI0Zjg3YjBiODQ1OTg4MmNiMTI0NTIyMjY0NDZkODVm"
    
    headers = {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json"
    }

    # Future dates
    check_in = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
    check_out = (date.today() + timedelta(days=31)).strftime("%Y-%m-%d")

    payload = {
        "target": "google_travel_hotels",
        "query": "Willmont Hotel Balikesir",
        "check_in": check_in,
        "check_out": check_out,
        "adults": 2,
        "currency": "USD",
        "geo": "Turkey",
        "locale": "en-US"
    }

    async with httpx.AsyncClient() as client:
        # 1. Submit Task
        print("Submitting Task to /v2/task...")
        try:
            resp = await client.post(
                "https://scraper-api.decodo.com/v2/task",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            print(f"Submit Status: {resp.status_code}")
            print(resp.text)
            
            if resp.status_code != 200:
                return

            data = resp.json()
            # Assuming resonse has 'id' or 'job_id'
            job_id = data.get("id") or data.get("job_id")
            
            if not job_id:
                print("No Job ID found.")
                return
                
            print(f"Job ID: {job_id}")
            
            # 2. Poll for Result
            print("Polling for results...")
            for i in range(10):
                await asyncio.sleep(5) # Wait 5s
                
                # Check status endpoint (Assuming /v2/task/{id} or similar, usually standard is GET /v2/task/{id})
                # Based on typical scraper APIs, verify docs pattern if failure.
                # Common pattern: GET https://scraper-api.decodo.com/v2/task/{id}
                
                poll_resp = await client.get(
                    f"https://scraper-api.decodo.com/v2/task/{job_id}/results",
                    headers=headers,
                    timeout=30.0
                )
                
                print(f"Poll {i+1} Status: {poll_resp.status_code}")
                poll_data = poll_resp.json()
                print(f"Poll {i+1} Body: {json.dumps(poll_data)[:300]}") # Print first 300 chars of JSON
                
                status = poll_data.get("status")
                print(f"Job Status: {status}")
                
                if status == "finished" or status == "ready":
                    print("SUCCESS! Data received.")
                    print(str(poll_data)[:500]) # Print first 500 chars
                    break
                elif status == "failed":
                    print("Job Failed explicitly.")
                    print(poll_resp.text)
                    break
                    
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_decodo_async())
