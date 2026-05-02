import os
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

try:
    from google import genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

_client: Optional[Any] = None

def get_genai_client() -> Optional[Any]:
    """Returns a singleton instance of the Google GenAI Client."""
    global _client
    if _client is None:
        if not HAS_GENAI:
            logger.warning("[AI] google-genai SDK missing. Running in Safe Mode.")
            return None
        try:
            # Check both possible env vars
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if api_key:
                _client = genai.Client(api_key=api_key)
            else:
                logger.warning("[AI] GOOGLE_API_KEY / GEMINI_API_KEY not found in environment.")
        except Exception as e:
            logger.error(f"[AI] Failed to initialize Google GenAI Client: {e}")
    return _client
