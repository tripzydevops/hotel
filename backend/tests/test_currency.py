import sys
import os
from unittest.mock import MagicMock, patch
import asyncio

# Add root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.services.serpapi_client import SerpApiClient

async def test_currency_passing():
    client = SerpApiClient(api_key="test_key")
    
    print("Testing currency parameter passing in SerpApiClient...")
    
    # Mocking httpx.AsyncClient.get to verify params
    with patch('httpx.AsyncClient.get') as mock_get:
        # Create a mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"properties": [{"name": "Test Hotel", "price": 100}]}
        mock_response.raise_for_status = MagicMock()
        
        # Setup the mock client
        mock_get.return_value = mock_response
        
        # Test 1: Default currency (USD)
        print("Test 1: Default currency (USD)")
        await client.fetch_hotel_price("Test Hotel", "Paris")
        args, kwargs = mock_get.call_args
        sent_params = kwargs.get('params', {})
        if sent_params.get('currency') == 'USD':
            print("PASS: Default currency is USD")
        else:
            print(f"FAIL: Default currency was {sent_params.get('currency')}")

        # Test 2: Specific currency (TRY)
        print("Test 2: Specific currency (TRY)")
        await client.fetch_hotel_price("Test Hotel", "Istanbul", currency="TRY")
        args, kwargs = mock_get.call_args
        sent_params = kwargs.get('params', {})
        if sent_params.get('currency') == 'TRY':
            print("PASS: Currency parameter TRY passed correctly")
        else:
            print(f"FAIL: Currency parameter TRY not passed correctly. Got: {sent_params.get('currency')}")

if __name__ == "__main__":
    asyncio.run(test_currency_passing())
