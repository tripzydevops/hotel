"""
test_rls_isolation.py — Multi-Tenant Isolation & IDOR Security Tests.

Verifies that Tenant A cannot access, mutate, or view Tenant B's:
1. User profiles & settings (verify_ownership)
2. Hotel rate intelligence & compsets (verify_hotel_ownership)
3. Scan sessions & history (verify_scan_session_ownership)
"""

from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from fastapi import HTTPException

from backend.utils.security import (
    verify_ownership,
    verify_hotel_ownership,
    verify_scan_session_ownership,
)


class MockUser:
    """Mock authenticated user object returned by auth dependencies."""
    def __init__(self, user_id: str, role: str = "user"):
        self.id = user_id
        self.role = role
        self.user_metadata = {"role": role}


# ---------------------------------------------------------------------------
# 1. User Identity Boundary Tests (verify_ownership)
# ---------------------------------------------------------------------------

def test_verify_ownership_same_user_permitted():
    """Tenant A accessing Tenant A's own resources is permitted."""
    tenant_a_id = str(uuid4())
    user_a = MockUser(tenant_a_id, role="user")
    
    assert verify_ownership(tenant_a_id, user_a) is True


def test_verify_ownership_cross_tenant_blocked():
    """Tenant A attempting to access Tenant B's resource is strictly blocked with 403."""
    tenant_a_id = str(uuid4())
    tenant_b_id = str(uuid4())
    user_a = MockUser(tenant_a_id, role="user")

    with pytest.raises(HTTPException) as exc_info:
        verify_ownership(tenant_b_id, user_a)
    
    assert exc_info.value.status_code == 403
    assert "ownership mismatch" in exc_info.value.detail.lower()


def test_verify_ownership_admin_bypass():
    """Platform administrator can bypass tenant boundaries for diagnostic/support purposes."""
    admin_id = str(uuid4())
    tenant_b_id = str(uuid4())
    admin_user = MockUser(admin_id, role="admin")

    assert verify_ownership(tenant_b_id, admin_user, admin_bypass=True) is True


def test_verify_ownership_admin_bypass_disabled():
    """When admin bypass is disabled, even an admin cannot impersonate Tenant B directly."""
    admin_id = str(uuid4())
    tenant_b_id = str(uuid4())
    admin_user = MockUser(admin_id, role="admin")

    with pytest.raises(HTTPException) as exc_info:
        verify_ownership(tenant_b_id, admin_user, admin_bypass=False)
    
    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# 2. Hotel Multi-Tenant Boundary Tests (verify_hotel_ownership)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_hotel_ownership_owned_hotel_permitted():
    """Tenant A accessing a hotel registered to their account is permitted."""
    tenant_a_id = str(uuid4())
    hotel_a_id = str(uuid4())

    mock_db = MagicMock()
    # Profile check returns regular user
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "role": "user"
    }
    # Mapping check returns valid association in user_hotels
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"user_id": tenant_a_id, "hotel_id": hotel_a_id}
    ]

    # Should complete with no exception raised
    await verify_hotel_ownership(mock_db, tenant_a_id, hotel_a_id)


@pytest.mark.asyncio
async def test_verify_hotel_ownership_unowned_hotel_blocked():
    """Tenant A attempting to access Tenant B's hotel is blocked with 403 IDOR error."""
    tenant_a_id = str(uuid4())
    hotel_b_id = str(uuid4())

    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "role": "user"
    }
    # Mapping check returns empty list (hotel not associated with Tenant A)
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    with pytest.raises(HTTPException) as exc_info:
        await verify_hotel_ownership(mock_db, tenant_a_id, hotel_b_id)

    assert exc_info.value.status_code == 403
    assert "access to this hotel" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_verify_hotel_ownership_admin_bypass_allowed():
    """Admin role bypasses hotel ownership check."""
    admin_id = str(uuid4())
    hotel_any_id = str(uuid4())

    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "role": "admin"
    }

    # Should not raise
    await verify_hotel_ownership(mock_db, admin_id, hotel_any_id, admin_bypass=True)


# ---------------------------------------------------------------------------
# 3. Scan Session Multi-Tenant Boundary Tests (verify_scan_session_ownership)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_scan_session_ownership_direct_user_match():
    """Session created directly by Tenant A is accessible by Tenant A."""
    tenant_a_id = str(uuid4())
    session_id = str(uuid4())

    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "user_id": tenant_a_id,
        "hotel_id": str(uuid4()),
    }

    await verify_scan_session_ownership(mock_db, tenant_a_id, session_id)


@pytest.mark.asyncio
async def test_verify_scan_session_ownership_cross_tenant_blocked():
    """Tenant A attempting to read Tenant B's scan session is rejected with 403."""
    tenant_a_id = str(uuid4())
    tenant_b_id = str(uuid4())
    session_id = str(uuid4())
    hotel_b_id = str(uuid4())

    mock_db = MagicMock()
    # Scan session belongs to Tenant B
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "user_id": tenant_b_id,
        "hotel_id": hotel_b_id,
        "role": "user",
    }
    # Hotel ownership fallback also returns empty (Tenant A does not own hotel B)
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    with pytest.raises(HTTPException) as exc_info:
        await verify_scan_session_ownership(mock_db, tenant_a_id, session_id)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_verify_scan_session_nonexistent_returns_404():
    """Requesting a session ID that does not exist returns 404 Not Found, not leaking existence."""
    tenant_a_id = str(uuid4())
    nonexistent_id = str(uuid4())

    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

    with pytest.raises(HTTPException) as exc_info:
        await verify_scan_session_ownership(mock_db, tenant_a_id, nonexistent_id)

    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail.lower()
