import unittest
import asyncio
from unittest.mock import MagicMock, patch
from uuid import uuid4
import sys

# Mock embeddings and genai
sys.modules["backend.utils.embeddings"] = MagicMock()
sys.modules["google"] = MagicMock()
sys.modules["google.genai"] = MagicMock()

from backend.agents.analyst_agent import AnalystAgent

class TestDataConsistency(unittest.IsolatedAsyncioTestCase):
    async def test_embedding_status_flow(self):
        """Verify that embedding_status changes appropriately on success/failure."""
        mock_db = MagicMock()
        # Ensure .table() returns same mock for easier tracking
        mock_table = MagicMock()
        mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.in_.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])
        
        hotel_id = str(uuid4())
        scraper_results = [
            {
                "hotel_id": hotel_id,
                "status": "success",
                "price_data": {
                    "price": 100, 
                    "currency": "USD",
                    "reviews_breakdown": {"Cleanliness": 4.5} # Triggers sentiment update
                }
            }
        ]
        
        # Scenario 1: Successful Embedding
        agent = AnalystAgent(mock_db)
        with patch.object(AnalystAgent, "_update_sentiment_embedding", new_callable=MagicMock) as mock_update:
            fut = asyncio.Future()
            fut.set_result(True)
            mock_update.return_value = fut
            
            await agent.analyze_results(uuid4(), scraper_results, uuid4())
            
            # Verify status was set to 'current' eventually
            update_method_calls = [str(c) for c in mock_table.update.mock_calls]
            status_current = any("'embedding_status': 'current'" in c for c in update_method_calls)
            self.assertTrue(status_current, "Should mark status as 'current' on success")

        # Scenario 2: Failed Embedding
        mock_table.update.reset_mock()
        agent2 = AnalystAgent(mock_db)
        with patch.object(AnalystAgent, "_update_sentiment_embedding", new_callable=MagicMock) as mock_update2:
            fut2 = asyncio.Future()
            fut2.set_result(False) # SIMULATE FAILURE
            mock_update2.return_value = fut2
            
            await agent2.analyze_results(uuid4(), scraper_results, uuid4())
            
            # Verify status was set to 'failed'
            update_method_calls = [str(c) for c in mock_table.update.mock_calls]
            status_failed = any("'embedding_status': 'failed'" in c for c in update_method_calls)
            self.assertTrue(status_failed, f"Should mark status as 'failed' on failure. Calls: {update_method_calls}")

if __name__ == "__main__":
    unittest.main()
