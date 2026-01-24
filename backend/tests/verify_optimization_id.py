
import asyncio
from unittest.mock import MagicMock, patch
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.serpapi_client import SerpApiClient

async def test_optimization():
    print("🧪 Starting Optimization Logic Verification...")
    
    client = SerpApiClient()
    
    # Mock Response
    mock_response = MagicMock()
    mock_response.json.return_value = {"properties": [], "organic_results": []} # Empty is fine, we just want to check params
    mock_response.raise_for_status.return_value = None
    
    # Test Case 1: With ID (Should have ht_id)
    print("\n[1] Testing WITH serp_api_id...")
    with patch("httpx.AsyncClient.get", new_callable=MagicMock) as mock_get:
        mock_get.return_value = asyncio.Future()
        mock_get.return_value.set_result(mock_response)
        
        await client.fetch_hotel_price(
            hotel_name="Test Hotel",
            location="Test City",
            serp_api_id="12345_TEST_ID"
        )
        
        # Verify params
        call_args = mock_get.call_args
        params = call_args[1]["params"]
        
        if params.get("ht_id") == "12345_TEST_ID":
            print("✅ SUCCESS: 'ht_id' was passed correctly!")
        else:
            print(f"❌ FAILURE: 'ht_id' missing or wrong. Params: {params}")

    # Test Case 2: Without ID (Should NOT have ht_id)
    print("\n[2] Testing WITHOUT serp_api_id...")
    with patch("httpx.AsyncClient.get", new_callable=MagicMock) as mock_get:
        mock_get.return_value = asyncio.Future()
        mock_get.return_value.set_result(mock_response)
        
        await client.fetch_hotel_price(
            hotel_name="Test Hotel",
            location="Test City",
            serp_api_id=None
        )
        
        call_args = mock_get.call_args
        params = call_args[1]["params"]
        
        if "ht_id" not in params:
            print("✅ SUCCESS: 'ht_id' was transparently omitted!")
        else:
            print(f"❌ FAILURE: 'ht_id' should not be here. Params: {params}")

if __name__ == "__main__":
    asyncio.run(test_optimization())
