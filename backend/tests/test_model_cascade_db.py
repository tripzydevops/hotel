"""
tests/test_model_cascade_db.py

Unit tests for database-driven AI model cascade configuration in ai_config.py.
Verifies that get_model_cascade reads active_model_cascade from admin_settings
when a db client is supplied, and falls back gracefully when db is None or errors out.
"""

import pytest
from unittest.mock import MagicMock
from backend.config.ai_config import get_model_cascade, ACTIVE_MODEL_CASCADE, DEFAULT_GEMINI_MODEL


class TestModelCascadeDB:
    """Tests for dynamic database-driven AI model cascade logic."""

    def test_default_cascade_without_db(self):
        """Without a DB client, get_model_cascade should return ACTIVE_MODEL_CASCADE defaults."""
        cascade = get_model_cascade()
        assert cascade == ACTIVE_MODEL_CASCADE
        assert cascade[0] == DEFAULT_GEMINI_MODEL

    def test_custom_model_prepended_without_db(self):
        """Providing custom_model should prepend it to the default cascade."""
        cascade = get_model_cascade(custom_model="custom-gemini-v1")
        assert cascade[0] == "custom-gemini-v1"
        assert len(cascade) == len(ACTIVE_MODEL_CASCADE) + 1

    def test_db_driven_cascade_override(self):
        """When db returns custom active_model_cascade, get_model_cascade should use DB settings."""
        mock_db = MagicMock()
        mock_res = MagicMock()
        mock_res.data = [{"active_model_cascade": ["gemini-pro-db-override", "gemini-3.1-pro-preview"]}]
        mock_db.table.return_value.select.return_value.limit.return_value.execute.return_value = mock_res

        cascade = get_model_cascade(db=mock_db)
        assert cascade == ["gemini-pro-db-override", "gemini-3.1-pro-preview"]

    def test_db_failure_graceful_fallback(self):
        """If database query raises an exception, get_model_cascade should fall back to defaults."""
        mock_db = MagicMock()
        mock_db.table.side_effect = Exception("DB Connection Timeout")

        cascade = get_model_cascade(db=mock_db)
        assert cascade == ACTIVE_MODEL_CASCADE
