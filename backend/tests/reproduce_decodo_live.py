import asyncio
import os
import json
from datetime import date, timedelta
from dotenv import load_dotenv
from backend.services.providers.decodo_provider import DecodoProvider

# Load envs
load_dotenv()
load_dotenv(".env.local", override=True)

async def debug_decodo():
    print("--- Starting Decodo Live Debug ---")
    
    api_key = os.getenv("DECODO_API_KEY")
    print(f"API Key Present: {bool(api_key)}")
    if not api_key:
        print("ERROR: Missing DECODO_API_KEY")
        return

    provider = DecodoProvider()
    print(f"Provider: {provider.get_provider_name()}")
    print(f"Base URL: {provider.BASE_URL}")

    # Use future dates
    check_in = date.today() + timedelta(days=30)
    check_out = check_in + timedelta(days=1)
    
    print(f"Querying for: Willmont Hotel Balikesir")
    print(f"Dates: {check_in} to {check_out}")

    try:
        # We'll call fetch_price but also print internals if we could, 
        # but here we rely on the print statements inside the provider or just the result.
        # Actually, let's manually invoke the logic to see RAW response.
        import httpx
        
        payload = {
            "target": "google_travel_hotels",
            "query": "Willmont Hotel Balikesir",
            "check_in": check_in.strftime("%Y-%m-%d"),
            "check_out": check_out.strftime("%Y-%m-%d"),
            "adults": 2,
            "currency": "USD",
            "geo": "Turkey", # Changed to Turkey since hotel is in Balikesir
            "locale": "en-US"
        }
        
        headers = {
            # User provided the Basic Auth Token explicitly: VTAwMDAzNTA0OTE6UFdfMTI0Zjg3YjBiODQ1OTg4MmNiMTI0NTIyMjY0NDZkODVm
            "Authorization": "Basic VTAwMDAzNTA0OTE6UFdfMTI0Zjg3YjBiODQ1OTg4MmNiMTI0NTIyMjY0NDZkODVm",
            "Content-Type": "application/json"
        }
        
        print("\nSending Payload:")
        print(json.dumps(payload, indent=2))

        async with httpx.AsyncClient() as client:
            response = await client.post(
                provider.BASE_URL,
                headers=headers,
                json=payload,
                timeout=60.0
            )
            
            print(f"\nResponse Status: {response.status_code}")
            print("Response Headers:", response.headers)
            print("Response Body Snippet (First 500 chars):")
            print(response.text[:500])
            
            if response.status_code == 200:
                data = response.json()
                # Try parsing
                parsed = provider._parse_response(data)
                print("\nParsed Result:")
                print(parsed)
            else:
                print("Request failed.")

    except Exception as e:
        print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    asyncio.run(debug_decodo())
