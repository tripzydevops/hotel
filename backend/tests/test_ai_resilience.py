import unittest
import os
import sys
from unittest.mock import patch, MagicMock

# Ensure we can import backend
sys.path.append(os.getcwd())

class TestAIResilience(unittest.TestCase):
    def test_ai_service_resilience(self):
        # Force HAS_GENAI to False to simulate missing package
        with patch("backend.services.ai_service.HAS_GENAI", False):
            from backend.services.ai_service import MarketIntelligenceService
            commander = MarketIntelligenceService()
            
            self.assertIsNone(commander.client)
            
            # Verify generate_market_brief returns a safe fallback instead of crashing
            import asyncio
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(commander.generate_market_brief({"test": "data"}))
            
            self.assertIn("brief", result)
            self.assertIn("unavailable", result["brief"].lower())
            self.assertEqual(result["status"], "offline")

    def test_ai_service_initialization_no_key(self):
        # Simulate missing API key
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            # We need to reload or re-import if it's already cached with a key
            # But in unittest each test should be relatively isolated if handled correctly
            from backend.services.ai_service import MarketIntelligenceService
            commander = MarketIntelligenceService()
            self.assertIsNone(commander.client)

if __name__ == "__main__":
    unittest.main()
