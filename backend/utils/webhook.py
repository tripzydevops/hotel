import gzip
import json
import logging
from fastapi import Request

logger = logging.getLogger(__name__)

async def get_webhook_payload(request: Request) -> dict:
    """
    Parses a webhook request body, handling GZIP decompression if needed.
    Some providers (like DataForSEO) send compressed payloads exclusively.
    """
    body = await request.body()
    
    # Check Content-Encoding header
    content_encoding = request.headers.get("Content-Encoding", "").lower()
    
    # Proactive check for GZIP magic number if header is missing but data is compressed
    is_gzip = content_encoding == "gzip" or body.startswith(b'\x1f\x8b')
    
    if is_gzip:
        try:
            decompressed = gzip.decompress(body)
            # Re-assign to body for JSON parsing
            body = decompressed
            logger.debug("Successfully decompressed GZIP payload")
        except Exception as e:
            logger.error(f"Failed to decompress GZIP payload: {e}")
            # If decompression fails, we'll try to parse as-is (maybe it's not actually gzip)
    
    if not body:
        return {}

    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse webhook JSON: {e}")
        # Log a snippet of the problematic body for debugging (careful with sensitive data)
        snippet = body[:200].decode(errors='replace')
        logger.debug(f"Payload snippet: {snippet}...")
        return {}
