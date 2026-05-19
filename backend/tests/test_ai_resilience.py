import unittest
import os
import sys
from unittest.mock import patch, MagicMock

# Ensure we can import backend
sys.path.append(os.getcwd())

# KAİZEN: Global mocks for all missing dependencies to allow tests to run in restricted environments
for mod in ['supabase', 'firecrawl', 'sse_starlette', 'dotenv', 'firecrawl-py']:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()
        if mod == 'dotenv':
            sys.modules['dotenv'].load_dotenv = MagicMock()

# Ensure we can import backend as a package
import backend
if not hasattr(backend, 'services'):
    backend.services = MagicMock()
if not hasattr(backend, 'utils'):
    backend.utils = MagicMock()

class TestAIResilience(unittest.TestCase):
    def test_ai_service_resilience(self):
        # Simulate missing client / Safe Mode
        with patch("backend.services.ai_service.get_genai_client", return_value=None):
            from backend.services.ai_service import MarketIntelligenceService
            commander = MarketIntelligenceService()
            
            self.assertIsNone(commander.client)
            
            # Verify generate_command_brief returns a safe fallback instead of crashing
            import asyncio
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(commander.generate_market_brief({"test": "data"}))
            
            self.assertIn("summary", result)
            summary_lower = result["summary"].lower()
            self.assertTrue("safe mode" in summary_lower or "error" in summary_lower)

    def test_ai_service_initialization_no_key(self):
        # Simulate missing API key / client
        with patch("backend.services.ai_service.get_genai_client", return_value=None):
            from backend.services.ai_service import MarketIntelligenceService
            commander = MarketIntelligenceService()
            self.assertIsNone(commander.client)

if __name__ == "__main__":
    unittest.main()
