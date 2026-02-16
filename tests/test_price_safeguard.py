
import unittest
from unittest.mock import MagicMock, patch
import asyncio
from datetime import datetime

# Import AnalystAgent
import sys
import os
# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
try:
    from backend.agents.analyst_agent import AnalystAgent
except ImportError:
    # Try alternate path if running from root
    from backend.agents.analyst_agent import AnalystAgent

class TestPriceSafeguard(unittest.TestCase):
    def setUp(self):
        self.mock_db = MagicMock()
        self.agent = AnalystAgent(self.mock_db)

    def test_validate_price_drop_valid(self):
        # Scenario: Price is 3500, Average is 4000. Drop is small (<50%).
        hotel_id = "test-hotel"
        current_price = 3500.0
        currency = "TRY"
        
        # Mock DB response
        # self.mock_db.table().select()...execute() -> object with .data
        mock_execute = MagicMock()
        mock_execute.data = [{"price": 4000.0} for _ in range(5)]
        
        # Chain setup
        self.mock_db.table.return_value \
            .select.return_value \
            .eq.return_value \
            .eq.return_value \
            .gt.return_value \
            .order.return_value \
            .limit.return_value \
            .execute.return_value = mock_execute
        
        is_valid, avg = self.agent._validate_price_drop(hotel_id, current_price, currency)
        
        print(f"Test Valid: Current={current_price}, Avg={avg}, IsValid={is_valid}")
        self.assertTrue(is_valid)
        self.assertEqual(avg, 4000.0)

    def test_validate_price_drop_suspicious(self):
        # Scenario: Price is 1000, Average is 4000. Drop is huge (>50%).
        hotel_id = "test-hotel"
        current_price = 1000.0
        currency = "TRY"
        
        # Mock DB response
        mock_execute = MagicMock()
        mock_execute.data = [{"price": 4000.0} for _ in range(5)]
        
        self.mock_db.table.return_value \
            .select.return_value \
            .eq.return_value \
            .eq.return_value \
            .gt.return_value \
            .order.return_value \
            .limit.return_value \
            .execute.return_value = mock_execute
        
        is_valid, avg = self.agent._validate_price_drop(hotel_id, current_price, currency)
        
        print(f"Test Suspicious: Current={current_price}, Avg={avg}, IsValid={is_valid}")
        self.assertFalse(is_valid) # Should be rejected
        self.assertEqual(avg, 4000.0)

if __name__ == "__main__":
    unittest.main()
