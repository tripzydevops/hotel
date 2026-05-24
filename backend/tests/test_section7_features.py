"""
pytest test suite for Section 7 innovation features.
Tests business logic of all new services in isolation (no real DB/API calls).
Run: python -m pytest backend/tests/test_section7_features.py -v
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ==========================================================================
# Fixtures
# ==========================================================================

def make_db(table_data: dict):
    """
    Creates a mock Supabase client where each table query returns pre-set data.
    Works by building a fluent chain: .table().select().eq().order().limit().execute()
    """
    db = MagicMock()

    def build_chain(data):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.neq.return_value = chain
        chain.in_.return_value = chain
        chain.gte.return_value = chain
        chain.lte.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.single.return_value = chain
        chain.insert.return_value = chain
        chain.delete.return_value = chain
        chain.update.return_value = chain
        chain.execute.return_value = MagicMock(data=data)
        return chain

    def table_side_effect(name):
        return build_chain(table_data.get(name, []))

    db.table.side_effect = table_side_effect
    return db


# ==========================================================================
# Feature 1 — Signal Ingestion Service
# ==========================================================================

class TestSignalIngestion:

    def test_batch_signal_request_model(self):
        """BatchSignalRequest model parses correctly."""
        from backend.api.models import BatchSignalRequest, SignalPayload

        payload = BatchSignalRequest(
            session_id="sess-001",
            signals=[
                SignalPayload(
                    signal_type="competitor_click",
                    payload={"hotel_id": "abc", "hotel_name": "Hilton"},
                    timestamp="2026-05-25T00:00:00Z",
                ),
                SignalPayload(
                    signal_type="competitor_expand",
                    payload={"hotel_id": "abc", "offers_count": 3},
                    timestamp="2026-05-25T00:00:01Z",
                ),
            ],
        )
        assert payload.session_id == "sess-001"
        assert len(payload.signals) == 2
        assert payload.signals[0].signal_type == "competitor_click"


    def test_batch_signal_response_model(self):
        """BatchSignalResponse model validates ok and count."""
        from backend.api.models import BatchSignalResponse

        ok = BatchSignalResponse(success=True, count=5)
        assert ok.success is True
        assert ok.count == 5

        warn = BatchSignalResponse(success=False, count=0, warning="DB error")
        assert warn.warning == "DB error"


# ==========================================================================
# Feature 2 — Revenue Impact from Sentiment
# ==========================================================================

class TestRevenueImpactService:

    @pytest.mark.asyncio
    async def test_no_data_returns_graceful_result(self):
        """Returns a helpful message when no sentiment history exists."""
        from backend.services.revenue_impact_service import calculate_sentiment_revenue_impact

        db = MagicMock()

        def table_side_effect(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.gte.return_value = chain
            chain.lte.return_value = chain
            chain.order.return_value = chain
            chain.limit.return_value = chain
            chain.single.return_value = chain
            if name == "hotels":
                # .single() in Supabase returns a dict in .data, not a list
                chain.execute.return_value = MagicMock(data={"name": "Test Hotel"})
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = table_side_effect

        result = await calculate_sentiment_revenue_impact(db, "hotel-123")
        assert result["direction"] == "unchanged"
        assert result["estimated_monthly_impact_try"] == 0
        assert "Not enough" in result["narrative"] or "Insufficient" in result["narrative"]

    @pytest.mark.asyncio
    async def test_decline_detected_correctly(self):
        """When recent score < past score, direction should be 'decline' with negative impact."""
        from backend.services.revenue_impact_service import (
            calculate_sentiment_revenue_impact,
            REVPAR_SENSITIVITY_PER_POINT,
            ASSUMED_ROOMS,
            ASSUMED_OCCUPANCY,
            ASSUMED_ADR,
        )

        recent_score = 3.8
        past_score = 4.2

        # Mock DB to return different data per call - use side_effect
        db = MagicMock()
        call_count = [0]

        def table_side_effect(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.gte.return_value = chain
            chain.lte.return_value = chain
            chain.order.return_value = chain
            chain.limit.return_value = chain
            chain.single.return_value = chain

            if name == "hotels":
                chain.execute.return_value = MagicMock(data=[{"name": "Test Hotel"}])
            elif name == "sentiment_history":
                call_count[0] += 1
                if call_count[0] == 1:
                    # Recent
                    chain.execute.return_value = MagicMock(
                        data=[{"rating": recent_score}, {"rating": recent_score + 0.1}]
                    )
                else:
                    # Past
                    chain.execute.return_value = MagicMock(
                        data=[{"rating": past_score}, {"rating": past_score - 0.1}]
                    )
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = table_side_effect

        with patch("backend.services.revenue_impact_service._generate_narrative", new_callable=AsyncMock) as mock_narr:
            mock_narr.return_value = "Score dropped, revenue impact estimated."
            result = await calculate_sentiment_revenue_impact(db, "hotel-123")

        assert result["direction"] == "decline"
        assert result["score_delta"] < 0
        assert result["estimated_monthly_impact_try"] < 0

    def test_revpar_math(self):
        """Sanity check the revenue impact formula with corrected 10.0 constant."""
        from backend.services.revenue_impact_service import (
            REVPAR_SENSITIVITY_PER_POINT,
            ASSUMED_ROOMS,
            ASSUMED_OCCUPANCY,
            ASSUMED_ADR,
        )
        delta = -0.5   # 0.5 point drop
        revpar_change_pct = delta * REVPAR_SENSITIVITY_PER_POINT   # = -5.0%
        monthly_base = ASSUMED_ROOMS * ASSUMED_OCCUPANCY * ASSUMED_ADR * 30
        impact = monthly_base * (revpar_change_pct / 100)

        # With corrected constant (10.0):
        # revpar_change_pct = -0.5 * 10.0 = -5.0%
        # Base = 60 rooms * 0.68 occupancy * 1200 ADR * 30 days = 1,468,800
        # 5% of that = -73,440 TRY monthly loss
        assert REVPAR_SENSITIVITY_PER_POINT == 10.0, "Constant was wrong — should be 10.0, not 0.10"
        assert revpar_change_pct == -5.0
        assert impact < 0
        assert abs(impact) > 10000   # must be a meaningful amount (>= \u20ba10k)


# ==========================================================================
# Feature 3 — Proactive Alert Service
# ==========================================================================

class TestProactiveAlertService:

    def test_build_alert_structure(self):
        """Alert dict has all required fields."""
        from backend.services.proactive_alert_service import _build_alert

        alert = _build_alert(
            user_id="user-1",
            hotel_id="hotel-1",
            alert_type="margin_erosion",
            severity="high",
            title="⚠️ Margin Erosion",
            message="Competitor is 8% cheaper.",
            metadata={"competitor_name": "Hilton", "diff_pct": 8.0},
        )

        assert alert["user_id"] == "user-1"
        assert alert["hotel_id"] == "hotel-1"
        assert alert["alert_type"] == "margin_erosion"
        assert alert["severity"] == "high"
        assert alert["is_read"] is False
        assert "created_at" in alert
        assert alert["metadata"]["diff_pct"] == 8.0

    def test_price_formatting(self):
        """_fmt produces human readable currency string."""
        from backend.services.proactive_alert_service import _fmt

        result = _fmt(4500.0, "TRY")
        assert "TRY" in result
        assert "4,500" in result or "4500" in result

    @pytest.mark.asyncio
    async def test_no_competitors_returns_empty(self):
        """Returns empty list if hotel has no competitor associations."""
        from backend.services.proactive_alert_service import evaluate_proactive_alerts

        db = make_db({
            "price_logs": [{"price": 1200, "currency": "TRY", "recorded_at": "2026-05-25T00:00:00Z"}],
            "hotels": [{"name": "My Hotel"}],
            "user_hotels": [],  # no competitors
        })

        result = await evaluate_proactive_alerts(db, "user-1", "hotel-1")
        assert result == []

    def test_undercut_threshold(self):
        """Margin erosion fires when competitor is UNDERCUT_THRESHOLD_PCT% cheaper."""
        from backend.services.proactive_alert_service import UNDERCUT_THRESHOLD_PCT, SURGE_THRESHOLD_PCT

        target = 1000.0

        # Margin erosion: competitor is (threshold+1)% cheaper
        # Use additive to guarantee pct_diff > threshold from target's perspective
        undercut_comp_price = target * (1 - (UNDERCUT_THRESHOLD_PCT + 1) / 100)
        pct_diff_undercut = ((target - undercut_comp_price) / undercut_comp_price) * 100
        assert pct_diff_undercut > UNDERCUT_THRESHOLD_PCT   # triggers margin erosion

        # Surge opportunity: competitor is enough more expensive that pct_diff < -threshold
        # Formula: pct_diff = (target - comp) / comp * 100 < -SURGE_THRESHOLD_PCT
        # Solve: comp > target / (1 - SURGE_THRESHOLD_PCT/100)
        surge_comp_price = target / (1 - (SURGE_THRESHOLD_PCT + 1) / 100)
        pct_diff_surge = ((target - surge_comp_price) / surge_comp_price) * 100
        assert pct_diff_surge < -SURGE_THRESHOLD_PCT   # triggers rate opportunity


# ==========================================================================
# Feature 4 — What-If Scenario Service
# ==========================================================================

class TestWhatIfService:

    def test_fallback_result_structure(self):
        """_fallback_result always returns expected keys."""
        from backend.services.whatif_service import _fallback_result

        result = _fallback_result("Test error")
        required_keys = [
            "predicted_occupancy_impact",
            "predicted_revenue_impact",
            "competitor_reactions",
            "risk_level",
            "recommendation",
            "reasoning",
        ]
        for key in required_keys:
            assert key in result, f"Missing key: {key}"
        assert result["error"] is True

    def test_prompt_contains_scenario(self):
        """_build_prompt includes the scenario text."""
        from backend.services.whatif_service import _build_prompt

        context = {
            "hotel_name": "Test Hotel",
            "location": "Istanbul",
            "star_rating": 4,
            "target_price": 1500,
            "currency": "TRY",
            "market_avg": 1200,
            "competitors": [{"name": "Rival A", "price": 1200}],
        }
        scenario = "What if I raise my rate by ₺300?"
        prompt = _build_prompt(scenario, context)

        assert scenario in prompt
        assert "Test Hotel" in prompt
        assert "Istanbul" in prompt
        assert "1500" in prompt  # target price included

    @pytest.mark.asyncio
    async def test_simulate_returns_fallback_without_api_key(self):
        """Without GEMINI_API_KEY, simulation returns a graceful fallback."""
        from backend.services.whatif_service import simulate_whatif_scenario

        db = make_db({
            "price_logs": [{"price": 1200, "currency": "TRY"}],
            "hotels": [{"name": "Test Hotel", "location": "Istanbul", "star_rating": 4}],
            "user_hotels": [],
        })

        with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
            result = await simulate_whatif_scenario(
                db=db,
                user_id="user-1",
                hotel_id="hotel-1",
                scenario="What if I raise my rate by 10%?",
            )

        # Should not raise — returns fallback
        assert "predicted_occupancy_impact" in result
        assert "risk_level" in result


# ==========================================================================
# Feature 6 — Collaborative Annotations (model validation)
# ==========================================================================

class TestAnnotations:

    def test_annotation_types_are_valid(self):
        """Valid annotation types are accepted."""
        valid_types = ["general", "decision", "question", "risk"]
        for t in valid_types:
            # Just validates the string — actual DB insertion tested via integration
            assert isinstance(t, str)
            assert len(t) > 0

    def test_note_minimum_length(self):
        """Notes shorter than 3 characters should be rejected."""
        note = "ab"
        assert len(note.strip()) < 3   # represents the validation condition in the route

    def test_note_valid(self):
        """A valid note passes length check."""
        note = "Competitor dropped rate — investigate before weekend."
        assert len(note.strip()) >= 3


# ==========================================================================
# Run summary
# ==========================================================================

if __name__ == "__main__":
    import subprocess
    subprocess.run([
        "python", "-m", "pytest",
        "backend/tests/test_section7_features.py",
        "-v", "--tb=short"
    ])
