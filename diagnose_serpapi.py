import asyncio
import os
import json
from datetime import date, timedelta
from backend.services.serpapi_client import SerpApiClient
from backend.utils.logger import get_logger

logger = get_logger(__name__)

HOTELS = [
    {
        "id": "ab824508-de7b-45ec-8448-c12e2955735b",
        "name": "Ramada Resort Kazdaglari Thermal and Spa",
        "serp_api_id": "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE",
        "location": "Balikesir, Turkey"
    },
    {
        "id": "ad339a8d-fabc-4d4a-97f2-9499be6e3c54",
        "name": "Willmont Hotel",
        "serp_api_id": "ChoI87ytpJjZ7eTzARoNL2cvMTFjbmN4cjRfMhAB",
        "location": "Balikesir, Turkey"
    },
    {
        "id": "84a57058-6216-44e7-82ed-f0e396761686",
        "name": "Ramada Residences By Wyndham Balikesir",
        "serp_api_id": "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB",
        "location": "Balikesir, Turkey"
    },
    {
        "id": "71222614-145e-493f-85f4-7044890bc2a8",
        "name": "Hilton Garden Inn Balikesir",
        "serp_api_id": "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE",
        "location": "Balikesir, Turkey"
    },
    {
        "id": "45d0a595-4079-48ee-b1b1-c293c1f9e75f",
        "name": "Altın Otel",
        "serp_api_id": "ChkI0NXi76z7rL9FGg0vZy8xMWMxOTBwMWo4EAE",
        "location": "Balikesir, Turkey"
    }
]

async def diagnose():
    client = SerpApiClient()
    check_in = date.today() + timedelta(days=1)
    
    results = []
    for hotel in HOTELS:
        logger.info(f"Diagnosing {hotel['name']}...")
        try:
            # We use a lower-level call to get the raw response if possible
            # But fetch_hotel_price is the main entry point
            result = await client.fetch_hotel_price(
                hotel_name=hotel['name'],
                location=hotel['location'],
                check_in=check_in,
                serp_api_id=hotel['serp_api_id'],
                currency="TRY"
            )
            
            summary = {
                "hotel": hotel['name'],
                "serp_api_id": hotel['serp_api_id'],
                "result": result
            }
            results.append(summary)
            
            if result:
                logger.info(f"SUCCESS: Found price {result.get('price')} with {len(result.get('offers', []))} offers.")
            else:
                logger.warning(f"FAILURE: No result returned for {hotel['name']}.")
                
        except Exception as e:
            logger.error(f"ERROR diagnosing {hotel['name']}: {e}")
            results.append({"hotel": hotel['name'], "error": str(e)})

    # Save results to a file for analysis
    with open("/tmp/serpapi_diagnosis.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print("\nDiagnosis complete. Results saved to /tmp/serpapi_diagnosis.json")

if __name__ == "__main__":
    asyncio.run(diagnose())
