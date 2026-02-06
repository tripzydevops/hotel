import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local", override=True)

API_URL = "http://127.0.0.1:8000"
USER_ID = "123e4567-e89b-12d3-a456-426614174000"

async def test_search_logging():
    print(f"--- Testing Search Logging for User: {USER_ID} ---")
    
    async with httpx.AsyncClient() as client:
        # 0. Health check
        print("Step 0: Checking health...")
        health_resp = await client.get(f"{API_URL}/api/health")
        print(f"  Health: {health_resp.status_code} - {health_resp.text}")

        # 1. Trigger a search
        search_query = "Test Hotel History"
        print(f"Step 1: Searching for '{search_query}'...")
        response = await client.get(
            f"{API_URL}/api/v1/directory/search",
            params={"q": search_query, "user_id": USER_ID}
        )
        
        if response.status_code == 200:
            print("  SUCCESS: Search endpoint responded.")
        else:
            print(f"  FAILED: Search endpoint returned {response.status_code}")
            return

        # 2. Check dashboard for the new log
        print("Step 2: Checking dashboard for log...")
        dashboard_response = await client.get(f"{API_URL}/api/dashboard/{USER_ID}")
        
        if dashboard_response.status_code == 200:
            data = dashboard_response.json()
            recent_searches = data.get("recent_searches", [])
            
            # Look for our search
            found = any(s["hotel_name"].lower() == search_query.lower() for s in recent_searches)
            
            if found:
                print(f"  SUCCESS: Found '{search_query}' in dashboard history.")
                # Print details of the record
                record = next(s for s in recent_searches if s["hotel_name"].lower() == search_query.lower())
                print(f"  Log Record: {record}")
            else:
                print(f"  FAILED: '{search_query}' NOT found in history.")
                print(f"  First 3 items: {recent_searches[:3]}")
        else:
            print(f"  FAILED: Dashboard endpoint returned {dashboard_response.status_code}")

if __name__ == "__main__":
    asyncio.run(test_search_logging())
