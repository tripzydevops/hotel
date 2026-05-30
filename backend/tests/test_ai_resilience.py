import unittest
import os
import sys
from unittest.mock import patch, MagicMock

# Ensure we can import backend
sys.path.append(os.getcwd())

# Ensure we can import backend as a package
import backend

class TestAIResilience(unittest.TestCase):
    def test_ai_service_resilience(self):
        # Simulate missing client / Safe Mode
        with patch("backend.services.ai_service.get_genai_client", return_value=None):
            from backend.services.ai_service import MarketIntelligenceService
            commander = MarketIntelligenceService()
            
            self.assertIsNone(commander.client)
            
            # Verify generate_command_brief returns a safe fallback instead of crashing
            import asyncio
            result = asyncio.run(commander.generate_market_brief({"test": "data"}))
            
            self.assertIn("summary", result)
            self.assertIn("strategic_actions", result)
            self.assertIn("market_sentiment", result)
            self.assertIn("market_stability", result)
            self.assertTrue(len(result["summary"]) > 0)

    def test_ai_service_initialization_no_key(self):
        # Simulate missing API key / client
        with patch("backend.services.ai_service.get_genai_client", return_value=None):
            from backend.services.ai_service import MarketIntelligenceService
            commander = MarketIntelligenceService()
            self.assertIsNone(commander.client)

if __name__ == "__main__":
    unittest.main()
