import pytest
from unittest.mock import patch, MagicMock
from backend.agents.persona_agent import build_compset_profile, CompsetProfileModel

@pytest.mark.asyncio
async def test_build_compset_profile_empty_signals():
    """Test that empty signals return a fallback compset profile."""
    result = await build_compset_profile([])
    assert isinstance(result, CompsetProfileModel)
    assert result.primary_threat == "Unknown"
    assert result.competitor_weights == {}

@pytest.mark.asyncio
@patch('backend.agents.persona_agent.genai.GenerativeModel')
async def test_build_compset_profile_success(mock_generative_model):
    """Test that valid signals produce a parsed compset profile."""
    mock_model_instance = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"primary_threat": "Hilton", "competitor_weights": {"Hilton": 0.8, "Sheraton": 0.2}, "blind_spots": ["Marriott"], "recommended_focus": "Focus on Hilton because they are very active.", "reasoning_trace": "Because of signals."}'
    mock_model_instance.generate_content.return_value = mock_response
    mock_generative_model.return_value = mock_model_instance

    signals = [
        {"user_id": "123", "signal_type": "competitor_click", "payload": {"hotel_name": "Hilton"}},
        {"user_id": "123", "signal_type": "dwell_time", "payload": {"duration_ms": 45000, "target": "Hilton Card"}}
    ]

    result = await build_compset_profile(signals)
    
    assert isinstance(result, CompsetProfileModel)
    assert result.primary_threat == "Hilton"
    assert result.competitor_weights["Hilton"] == 0.8
    assert result.reasoning_trace == "Because of signals."

@pytest.mark.asyncio
@patch('backend.agents.persona_agent.genai.GenerativeModel')
async def test_build_compset_profile_failure_fallback(mock_generative_model):
    """Test that an LLM failure returns a safe fallback."""
    mock_model_instance = MagicMock()
    mock_model_instance.generate_content.side_effect = Exception("API Timeout")
    mock_generative_model.return_value = mock_model_instance

    signals = [{"signal_type": "competitor_click"}]
    result = await build_compset_profile(signals)

    assert result.primary_threat == "Unknown"
    assert "Fallback due to inference error" in result.reasoning_trace
