"""
Centralized AI Configuration & Model Registry.
Single source of truth for active Gemini model names and fallback cascades.
"""

import re
import json
from typing import Any, List

# Primary active Gemini model (validated against Google GenAI API 2026)
DEFAULT_GEMINI_MODEL = "gemini-3.1-pro-preview"

# Fallback cascade ordered by preference & availability
ACTIVE_MODEL_CASCADE: List[str] = [
    "gemini-3.1-pro-preview",
    "gemini-pro-latest",
    "gemini-omni-flash-preview",
]

# Canonical embedding model
DEFAULT_EMBEDDING_MODEL = "models/gemini-embedding-2"


def get_model_cascade(custom_model: str = None, db: Any = None) -> List[str]:
    """
    Returns a deduplicated list of active models starting with custom_model (if provided).
    If db client is provided, attempts to fetch active_model_cascade from admin_settings table.
    Falls back gracefully to ACTIVE_MODEL_CASCADE default registry.
    """
    base_cascade = list(ACTIVE_MODEL_CASCADE)

    if db:
        try:
            res = db.table("admin_settings").select("active_model_cascade").limit(1).execute()
            if res.data and res.data[0].get("active_model_cascade"):
                db_cascade = res.data[0]["active_model_cascade"]
                if isinstance(db_cascade, list) and len(db_cascade) > 0:
                    base_cascade = [str(m) for m in db_cascade]
        except Exception:
            pass

    cascade = []
    if custom_model:
        cascade.append(custom_model)

    for m in base_cascade:
        if m not in cascade:
            cascade.append(m)

    return cascade


def extract_llm_json(text: str) -> Any:
    """
    Safely parses JSON from an LLM response string.

    Gemini (and other LLMs) may wrap JSON in markdown code fences even when
    response_mime_type='application/json' is set. This function strips any
    leading/trailing markdown fences before parsing, preventing crash on
    responses like:
        ```json
        { ... }
        ```

    Raises:
        json.JSONDecodeError: if no valid JSON can be extracted.
    """
    if not text:
        raise json.JSONDecodeError("Empty LLM response", "", 0)

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    cleaned = fence_match.group(1).strip() if fence_match else text.strip()

    # As a last resort, find the first { or [ and attempt to parse from there
    if not cleaned.startswith(("{", "[")):
        brace = next((i for i, c in enumerate(cleaned) if c in "{["), None)
        if brace is not None:
            cleaned = cleaned[brace:]

    return json.loads(cleaned)
