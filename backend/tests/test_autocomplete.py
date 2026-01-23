
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.serpapi_client import SerpApiClient

@pytest.mark.asyncio
async def test_search_hotels_fallback():
    # Mock response from SerpApi
    mock_response = {
        "properties": [
            {
                "name": "Test Hotel One",
                "description": "A great place", 
                "hotel_id": "123"
            },
            {
                "name": "Test Hotel Two",
                "description": "Another nice place",
                "hotel_id": "456"
            }
        ]
    }

    # Patch httpx.AsyncClient
    with patch("httpx.AsyncClient") as MockClient:
        # Create a combined mock
        mock_instance = MagicMock()
        # __aenter__ must be async
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        
        # Setup the response
        mock_response_obj = MagicMock()
        mock_response_obj.json.return_value = mock_response
        mock_response_obj.raise_for_status.return_value = None
        
        # Configure get method as async
        mock_instance.get = AsyncMock(return_value=mock_response_obj)
        
        # Make the class return our mock instance
        MockClient.return_value = mock_instance

        client = SerpApiClient(api_key="mock_key")
        results = await client.search_hotels("Test Hotel")

        assert len(results) == 2
        assert results[0]["name"] == "Test Hotel One"
        assert results[0]["source"] == "serpapi"
        assert results[0]["serp_api_id"] == "123"
