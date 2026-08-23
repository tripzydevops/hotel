"""
tests/test_extract_llm_json.py

Unit tests for the extract_llm_json() utility in ai_config.py.
This function is critical — it is the safety net between raw Gemini LLM output
and json.loads() across the entire agent pipeline. A regression here would
cause silent crashes in persona_agent and whatif_service.
"""

import json
import pytest
from backend.config.ai_config import extract_llm_json


class TestExtractLlmJson:
    """Tests for extract_llm_json() — the LLM response JSON parser."""

    def test_plain_json_object(self):
        """Standard bare JSON object should parse cleanly."""
        result = extract_llm_json('{"key": "value", "count": 42}')
        assert result == {"key": "value", "count": 42}

    def test_plain_json_array(self):
        """Standard bare JSON array should parse cleanly."""
        result = extract_llm_json('[1, 2, 3]')
        assert result == [1, 2, 3]

    def test_markdown_json_fence(self):
        """Gemini often wraps responses in ```json fences — must strip cleanly."""
        text = '```json\n{"primary_threat": "Hilton", "score": 0.9}\n```'
        result = extract_llm_json(text)
        assert result["primary_threat"] == "Hilton"
        assert result["score"] == 0.9

    def test_generic_markdown_fence(self):
        """Triple-backtick fence without 'json' label should also be handled."""
        text = '```\n{"status": "ok"}\n```'
        result = extract_llm_json(text)
        assert result == {"status": "ok"}

    def test_prose_prefix_then_json(self):
        """LLM sometimes adds a sentence before the JSON — should recover gracefully."""
        text = 'Here is the analysis you requested:\n{"recommendation": "raise price"}'
        result = extract_llm_json(text)
        assert result["recommendation"] == "raise price"

    def test_whitespace_padding(self):
        """Leading and trailing whitespace should be stripped without issue."""
        text = '   \n\n  {"padded": true}  \n\n  '
        result = extract_llm_json(text)
        assert result["padded"] is True

    def test_nested_json(self):
        """Deeply nested structures should parse correctly."""
        text = '{"level1": {"level2": {"level3": [1, 2, 3]}}}'
        result = extract_llm_json(text)
        assert result["level1"]["level2"]["level3"] == [1, 2, 3]

    def test_empty_string_raises(self):
        """An empty string is unrecoverable — should raise json.JSONDecodeError."""
        with pytest.raises(json.JSONDecodeError):
            extract_llm_json("")

    def test_none_like_empty_raises(self):
        """Whitespace-only string is also unrecoverable."""
        with pytest.raises((json.JSONDecodeError, Exception)):
            extract_llm_json("   ")

    def test_invalid_json_raises(self):
        """Malformed JSON that cannot be recovered should raise json.JSONDecodeError."""
        with pytest.raises(json.JSONDecodeError):
            extract_llm_json("this is just plain text with no JSON")

    def test_compset_profile_shape(self):
        """
        Regression test: simulates exact Gemini persona_agent response shape.
        Ensures extract_llm_json works end-to-end for CompsetProfileModel input.
        """
        text = """```json
{
  "primary_threat": "Hilton Garden Inn",
  "competitor_weights": {"Hilton Garden Inn": 0.7, "Marriott": 0.3},
  "blind_spots": ["Sheraton"],
  "recommended_focus": "Monitor Hilton Garden Inn pricing more closely.",
  "reasoning_trace": "User clicked on Hilton 7 times vs Marriott 3 times."
}
```"""
        result = extract_llm_json(text)
        assert result["primary_threat"] == "Hilton Garden Inn"
        assert result["competitor_weights"]["Hilton Garden Inn"] == 0.7
        assert "Sheraton" in result["blind_spots"]
        assert isinstance(result["reasoning_trace"], str)

    def test_whatif_scenario_shape(self):
        """
        Regression test: simulates exact Gemini whatif_service response shape.
        """
        text = '{"projected_occupancy": 0.72, "revenue_delta": 1200.0, "risk_level": "medium"}'
        result = extract_llm_json(text)
        assert result["projected_occupancy"] == 0.72
        assert result["risk_level"] == "medium"
