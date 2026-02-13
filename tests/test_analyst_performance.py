import asyncio
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime
import sys
from unittest.mock import MagicMock, patch

# Mock the embeddings and genai before importing AnalystAgent
mock_embeddings = MagicMock()
sys.modules["backend.utils.embeddings"] = mock_embeddings
sys.modules["google"] = MagicMock()
sys.modules["google.genai"] = MagicMock()

from backend.agents.analyst_agent import AnalystAgent

class TestAnalystPerformance(unittest.IsolatedAsyncioTestCase):
    async def test_batch_efficiency(self):
        # 1. Setup Mock DB
        mock_db = MagicMock()
        
        # Configure the mock to return data for pre-fetch and other queries
        # Pre-fetch check
        mock_db.table().select().in_().order().limit().execute.return_value.data = [
            {"hotel_id": "h1", "price": 100.0, "currency": "TRY", "recorded_at": datetime.now().isoformat()},
            {"hotel_id": "h2", "price": 200.0, "currency": "TRY", "recorded_at": datetime.now().isoformat()}
        ]
        
        # Metadata updates (individual for now, but pre-buffered)
        mock_db.table().update().eq().execute.return_value.data = [{"id": "h1"}]
        
        # Batch inserts (logs, sentiment, alerts)
        mock_db.table().insert().execute.return_value.data = []

        agent = AnalystAgent(mock_db)
        
        # 2. Mock Scraper Results
        scraper_results = [
            {
                "hotel_id": "h1",
                "status": "success",
                "price_data": {
                    "price": 110.0,
                    "currency": "TRY",
                    "source": "serpapi",
                    "rating": 4.5
                }
            },
            {
                "hotel_id": "h2",
                "status": "success",
                "price_data": {
                    "price": 210.0,
                    "currency": "TRY",
                    "source": "serpapi",
                    "rating": 4.0
                }
            }
        ]
        
        # 3. Reset mocks to only count Agent activity
        mock_db.reset_mock()
        
        # 4. Analyze Results (with Sentiment Embedding Mocked)
        with patch.object(AnalystAgent, '_update_sentiment_embedding', return_value=asyncio.Future()):
            # We fulfill the future immediately
            AnalystAgent._update_sentiment_embedding.return_value.set_result(None)
            
            summary = await agent.analyze_results(
                user_id=uuid4(),
                scraper_results=scraper_results,
                session_id=uuid4()
            )
        
        # 5. Verify Batching
        # We count 'execute()' calls which represent actual DB round-trips
        # Chained calls themselves are recorded on the root mock, so we check for 'execute()'
        execute_calls = [c for c in mock_db.mock_calls if c[0].endswith('execute')]
        
        print(f"Total EXECUTE calls (round-trips): {len(execute_calls)}")
        for i, call in enumerate(execute_calls):
            print(f"  {i+1}: {call}")

        # Expectations for 2 hotels:
        # 1. Pre-fetch SELECT (execute)
        # 2. Update Hotel 1 (execute)
        # 3. Update Hotel 2 (execute)
        # 4. Batch Insert price_logs (execute)
        # 5. Batch Insert sentiment_history (execute)
        # 6. Session Update (execute)
        # Total: 6 calls
        
        # Before optimization it would be ~10+ calls.
        self.assertLessEqual(len(execute_calls), 7, f"Should minimize round-trips. Found {len(execute_calls)}")
        
        # Verify first call was a SELECT (pre-fetch)
        self.assertIn('select', str(execute_calls[0]), "First call should be the batch pre-fetch")

if __name__ == "__main__":
    unittest.main()
