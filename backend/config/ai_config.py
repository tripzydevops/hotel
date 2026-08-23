"""
Centralized AI Configuration & Model Registry.
Single source of truth for active Gemini model names and fallback cascades.
"""

from typing import List

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


def get_model_cascade(custom_model: str = None) -> List[str]:
    """
    Returns a deduplicated list of active models starting with the custom_model (if provided).
    """
    cascade = []
    if custom_model:
        cascade.append(custom_model)

    for m in ACTIVE_MODEL_CASCADE:
        if m not in cascade:
            cascade.append(m)

    return cascade
