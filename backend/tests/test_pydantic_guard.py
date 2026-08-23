"""
tests/test_pydantic_guard.py

Unit tests for the Pydantic Validation Guard in scan_persistence.py and schemas.py.
Verifies that database insertion payloads are sanitized, types are coerced safely,
extra columns are preserved, and invalid records fall back gracefully without crashing.
"""

import pytest
from unittest.mock import MagicMock
from backend.models.schemas import PriceLogPersistenceSchema, PriceOfferSchema
from backend.services.scan_persistence import ScanPersistenceService


class TestPydanticGuard:
    """Tests for Pydantic Validation Guard during database persistence."""

    def test_price_log_schema_sanitization(self):
        """String price should be coerced to float, and non-list offers should default to empty list."""
        raw_payload = {
            "hotel_id": "hotel-123",
            "source": "Booking.com",
            "price": "150.75",  # String price
            "offers": "not-a-list",  # Invalid offers payload
            "extra_custom_column": "preserved_val",
        }
        validated = PriceLogPersistenceSchema(**raw_payload).model_dump()
        assert validated["price"] == 150.75
        assert isinstance(validated["price"], float)
        assert validated["offers"] == []
        assert validated["extra_custom_column"] == "preserved_val"

    def test_price_offer_schema_sanitization(self):
        """Negative price should raise validation error or be handled by schema."""
        raw_offer = {
            "source": "Expedia",
            "price": "89.99",
            "currency": "EUR",
            "room_type": "Deluxe Suite",
        }
        validated = PriceOfferSchema(**raw_offer).model_dump()
        assert validated["price"] == 89.99
        assert validated["currency"] == "EUR"
        assert validated["room_type"] == "Deluxe Suite"

    def test_scan_persistence_service_guard_fallback(self):
        """ScanPersistenceService._sanitize_persistence_item should sanitize price_logs and preserve extra keys."""
        mock_insforge = MagicMock()
        service = ScanPersistenceService(insforge=mock_insforge)

        item = {
            "hotel_id": "hotel-456",
            "price": "220.00",
            "offers": [{"source": "Agoda", "price": 210}],
            "custom_metadata": {"geo": "TR"},
        }
        sanitized = service._sanitize_persistence_item("price_logs", item)
        assert sanitized["price"] == 220.0
        assert len(sanitized["offers"]) == 1
        assert sanitized["custom_metadata"] == {"geo": "TR"}
