"""
pytest test suite for CopilotAgent and Copilot chat API endpoints.
Tests conversational logic, tool dispatching, and heuristic safe mode.
Run: uv run pytest backend/tests/test_copilot_agent.py -v
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from backend.main import app
from backend.agents.copilot_agent import CopilotAgent
from backend.services.auth_service import get_current_active_user, get_supabase_rls


# ==========================================================================
# Mocking Helpers
# ==========================================================================

def make_mock_db():
    """Creates a mock Supabase client for DB calls."""
    db = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = MagicMock(data=[])
    db.table.return_value = chain
    return db


# ==========================================================================
# CopilotAgent Core Logic & Tool Dispatch Tests
# ==========================================================================

class TestCopilotAgentCore:

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.fetch_historical_rates", new_callable=AsyncMock)
    async def test_tool_execute_historical_rates(self, mock_fetch):
        """Verify that _execute_tool routes 'get_historical_rates' to the service."""
        mock_fetch.return_value = [{"price": 1500, "currency": "TRY"}]
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        res = await agent._execute_tool("get_historical_rates", {"hotel_id": "hotel-abc", "days": 15})
        mock_fetch.assert_called_once_with(db, hotel_id="hotel-abc", days=15)
        assert res == [{"price": 1500, "currency": "TRY"}]

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.fetch_parity_alerts", new_callable=AsyncMock)
    async def test_tool_execute_parity_alerts(self, mock_fetch):
        """Verify that _execute_tool routes 'get_parity_alerts' to the service."""
        mock_fetch.return_value = [{"severity": "high", "message": "Parity leak detected on Booking.com"}]
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        res = await agent._execute_tool("get_parity_alerts", {"hotel_id": "hotel-abc"})
        mock_fetch.assert_called_once_with(db, hotel_id="hotel-abc")
        assert len(res) == 1
        assert res[0]["severity"] == "high"

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.fetch_sentiment_analysis", new_callable=AsyncMock)
    async def test_tool_execute_sentiment_analysis(self, mock_fetch):
        """Verify that _execute_tool routes 'get_sentiment_analysis' to the service."""
        mock_fetch.return_value = {"gri": 88.5, "reviews": []}
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        res = await agent._execute_tool("get_sentiment_analysis", {"hotel_id": "hotel-abc"})
        mock_fetch.assert_called_once_with(db, hotel_id="hotel-abc", limit=5)
        assert res["gri"] == 88.5

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.create_copilot_pdf_report", new_callable=AsyncMock)
    async def test_tool_execute_pdf_generation(self, mock_pdf):
        """Verify that _execute_tool routes 'generate_downloadable_pdf' to the service."""
        mock_pdf.return_value = {"status": "success", "download_url": "http://example.com/report.pdf"}
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        res = await agent._execute_tool("generate_downloadable_pdf", {
            "target_hotel_id": "hotel-abc",
            "report_type": "Strategic Market Pulse",
        })
        mock_pdf.assert_called_once_with(db, user_id="user-123", target_hotel_id="hotel-abc", rival_hotel_id=None, report_type="Strategic Market Pulse", days=30)
        assert res["download_url"] == "http://example.com/report.pdf"


# ==========================================================================
# Heuristic Fallback (Safe Mode) Tests
# ==========================================================================

class TestCopilotHeuristicFallback:

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.fetch_historical_rates", new_callable=AsyncMock)
    async def test_heuristic_rates_trigger(self, mock_fetch):
        """Keyword triggers fallback data query for rate trends."""
        mock_fetch.return_value = [{"price": 120.0, "currency": "USD"}]
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        result = await agent.chat(
            message="Show me the rate history",
            history=[],
            screen_context={"active_hotel_id": "hotel-1", "active_hotel_name": "Grand Hotel"}
        )

        assert mock_fetch.called
        assert "Grand Hotel" in result["reply"]
        assert "Average Rate" in result["reply"]
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["tool"] == "get_historical_rates"

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.fetch_parity_alerts", new_callable=AsyncMock)
    async def test_heuristic_parity_trigger(self, mock_fetch):
        """Keyword triggers fallback data query for alerts."""
        mock_fetch.return_value = [{"severity": "critical", "message": "Booking.com violation"}]
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        result = await agent.chat(
            message="Do we have any active parity violations?",
            history=[],
            screen_context={"active_hotel_id": "hotel-1", "active_hotel_name": "Grand Hotel"}
        )

        assert mock_fetch.called
        assert "Grand Hotel" in result["reply"]
        assert "Booking.com violation" in result["reply"]
        assert result["tool_calls"][0]["tool"] == "get_parity_alerts"

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.simulate_rate", new_callable=AsyncMock)
    async def test_heuristic_simulation_trigger(self, mock_simulate):
        """Keyword triggers rate simulation."""
        mock_simulate.return_value = {"reasoning": "Occupancy should rise to 70% if rate is set to ₺1500."}
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        result = await agent.chat(
            message="simulate a what-if optimal projection",
            history=[],
            screen_context={"active_hotel_id": "hotel-1", "active_hotel_name": "Grand Hotel"}
        )

        assert mock_simulate.called
        assert "Rate Simulation" in result["reply"]
        assert "₺1500" in result["reply"]
        assert result["tool_calls"][0]["tool"] == "simulate_rate_adjustment"

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.fetch_sentiment_analysis", new_callable=AsyncMock)
    async def test_heuristic_sentiment_trigger(self, mock_sentiment):
        """Keyword triggers sentiment / guest review summarization."""
        mock_sentiment.return_value = {
            "gri": 92.5,
            "categories": {"Service": 9.5},
            "reviews": [{"text": "Great service!", "source": "Tripadvisor"}]
        }
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        result = await agent.chat(
            message="what is my TripAdvisor guest satisfaction score?",
            history=[],
            screen_context={"active_hotel_id": "hotel-1", "active_hotel_name": "Grand Hotel"}
        )

        assert mock_sentiment.called
        assert "Guest Rating Index" in result["reply"]
        assert "92.5" in result["reply"]
        assert "Great service!" in result["reply"]

    @pytest.mark.asyncio
    @patch("backend.agents.copilot_agent.create_copilot_pdf_report", new_callable=AsyncMock)
    async def test_heuristic_pdf_trigger(self, mock_pdf):
        """Keyword triggers PDF generation."""
        mock_pdf.return_value = {
            "title": "Strategic Market Pulse",
            "download_url": "http://hotelplustr.com/dl/report.pdf"
        }
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        result = await agent.chat(
            message="download pdf file",
            history=[],
            screen_context={"active_hotel_id": "hotel-1", "active_hotel_name": "Grand Hotel"}
        )

        assert mock_pdf.called
        assert "PDF Report Generated" in result["reply"]
        assert "http://hotelplustr.com/dl/report.pdf" in result["reply"]

    @pytest.mark.asyncio
    async def test_heuristic_default_trigger(self):
        """Message with no keyword triggers default helpful capabilities checklist."""
        db = make_mock_db()
        agent = CopilotAgent(db=db, user_id="user-123")

        result = await agent.chat(
            message="hello, who are you?",
            history=[],
            screen_context={"active_hotel_id": "hotel-1"}
        )

        assert "Revenue Intelligence Advisor" in result["reply"]
        assert "Live Web Search" in result["reply"]
        assert result["tool_calls"] == []


# ==========================================================================
# Copilot Chat API Route Integration Tests
# ==========================================================================

class TestCopilotChatRoute:

    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        """Setup dependency overrides to bypass real JWT authentication & RLS client."""
        class MockUser:
            id = "mock-user-123"
            email = "test@example.com"

        # Mock dependencies in FastAPI
        app.dependency_overrides[get_current_active_user] = lambda: MockUser()
        app.dependency_overrides[get_supabase_rls] = make_mock_db

        yield

        # Cleanup overrides
        app.dependency_overrides.clear()

    @patch("backend.agents.copilot_agent.fetch_parity_alerts", new_callable=AsyncMock)
    def test_copilot_chat_endpoint_success(self, mock_fetch):
        """Verify POST /api/copilot/chat endpoint returns 200 and calls the agent."""
        mock_fetch.return_value = []
        client = TestClient(app)

        payload = {
            "message": "check parity issues",
            "history": [],
            "screen_context": {
                "page": "dashboard",
                "active_hotel_id": "88888888-8888-8888-8888-888888888888",
                "active_hotel_name": "Test Inn"
            }
        }

        response = client.post("/api/copilot/chat", json=payload)
        assert response.status_code == 200, response.text
        data = response.json()
        assert "reply" in data
        assert "tool_calls" in data
        assert "No unresolved parity alerts" in data["reply"]
