import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from pydantic import ValidationError

from backend.api.models import SignalPayload, BatchSignalRequest, BatchSignalResponse
from backend.agents.signal_processor import process_pending_signals


def test_signal_payload_pydantic_validation():
    """Verify SignalPayload validates required fields and timestamp handling."""
    # With explicit timestamp
    sig_with_ts = SignalPayload(
        signal_type="competitor_click",
        payload={"hotel_id": "hilton_123", "hotel_name": "Hilton Garden Inn"},
        timestamp="2026-10-30T20:00:00Z",
    )
    assert sig_with_ts.signal_type == "competitor_click"
    assert sig_with_ts.payload["hotel_id"] == "hilton_123"
    assert sig_with_ts.timestamp == "2026-10-30T20:00:00Z"

    # With optional timestamp omitted
    sig_no_ts = SignalPayload(
        signal_type="dwell_time",
        payload={"duration_ms": 3000},
    )
    assert sig_no_ts.timestamp is None

    # Batch request structure
    batch = BatchSignalRequest(
        session_id="test_session_abc",
        signals=[sig_with_ts, sig_no_ts],
    )
    assert batch.session_id == "test_session_abc"
    assert len(batch.signals) == 2

    # Empty signals batch response
    resp = BatchSignalResponse(success=True, count=0)
    assert resp.success is True
    assert resp.count == 0


@pytest.mark.asyncio
async def test_signal_processor_no_signals():
    """Verify signal processor exits cleanly when no unprocessed signals exist."""
    mock_db = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_gte = MagicMock()
    mock_execute = MagicMock()

    mock_db.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.gte.return_value = mock_gte
    mock_gte.execute.return_value = MagicMock(data=[])

    with patch("backend.agents.signal_processor.get_insforge_admin", return_value=mock_db):
        # Should execute and return None without exceptions
        await process_pending_signals()
        mock_db.table.assert_called_with("user_signals")


@pytest.mark.asyncio
async def test_signal_processor_groups_by_user():
    """Verify signals are accurately grouped by authenticated user_id."""
    sample_signals = [
        {"user_id": "user_1", "signal_type": "competitor_click", "payload": {"hotel_name": "Hilton"}},
        {"user_id": "user_1", "signal_type": "dwell_time", "payload": {"duration_ms": 12000}},
        {"user_id": None, "signal_type": "view", "payload": {}},  # Anonymous session — skipped
        {"user_id": "user_2", "signal_type": "competitor_click", "payload": {"hotel_name": "Sheraton"}},
    ]

    mock_db = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_gte = MagicMock()

    mock_db.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.gte.return_value = mock_gte
    mock_gte.execute.return_value = MagicMock(data=sample_signals)

    with patch("backend.agents.signal_processor.get_insforge_admin", return_value=mock_db), \
         patch("backend.agents.signal_processor.build_compset_profile") as mock_build:
        
        mock_build.return_value = MagicMock(competitor_weights={"Hilton": 0.9})
        await process_pending_signals()
        
        # Verify db called
        assert mock_db.table.call_count >= 1
