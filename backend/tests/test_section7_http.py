"""
HTTP Integration Tests for Section 7 endpoints.
Requires the backend to be running on http://127.0.0.1:8000

Run: python -m pytest backend/tests/test_section7_http.py -v --tb=short

Tests hit real HTTP endpoints but use anonymous/unauthenticated requests
to verify the routes exist and return expected status codes (not 404/500).
Auth-protected routes are expected to return 401/403, NOT 404 or 500.
"""

import pytest
import httpx

BASE = "http://127.0.0.1:8000"
TIMEOUT = 10.0

# A fake UUID for hotel_id — routes should reject with 401/403, not 404/500
FAKE_HOTEL_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE, timeout=TIMEOUT) as c:
        yield c


# ===========================================================================
# Sanity: backend is up
# ===========================================================================

def test_backend_health(client):
    """Backend is reachable and /api/health returns 200."""
    r = client.get("/api/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"


def test_openapi_schema_includes_new_routes(client):
    """OpenAPI schema lists all our new routes."""
    r = client.get("/api/openapi.json")
    assert r.status_code == 200
    schema = r.json()
    paths = schema.get("paths", {})

    expected = [
        "/api/signals/batch",
        f"/api/v1/alerts/evaluate/{'{hotel_id}'}",
        f"/api/v1/analysis/revenue-impact/{'{hotel_id}'}",
        "/api/v1/analysis/whatif",
        f"/api/v1/hotels/{'{hotel_id}'}/annotations",
        f"/api/v1/hotels/{'{hotel_id}'}/annotations/meeting-prep",
    ]
    missing = [ep for ep in expected if ep not in paths]
    assert not missing, f"Missing from OpenAPI schema: {missing}"


# ===========================================================================
# Feature 1 — POST /api/signals/batch
# ===========================================================================

def test_signals_batch_requires_auth(client):
    """Unauthenticated signal batch returns 401 or 403, not 404 or 500."""
    r = client.post("/api/signals/batch", json={
        "session_id": "test-session",
        "signals": [
            {
                "signal_type": "competitor_click",
                "payload": {"hotel_id": FAKE_HOTEL_ID, "hotel_name": "Test"},
                "timestamp": "2026-05-25T00:00:00Z",
            }
        ],
    })
    assert r.status_code in (401, 403), (
        f"Expected 401/403 for unauthed signal batch, got {r.status_code}: {r.text[:200]}"
    )


# ===========================================================================
# Feature 2 — GET /api/v1/analysis/revenue-impact/{hotel_id}
# ===========================================================================

def test_revenue_impact_requires_auth(client):
    """Unauthenticated revenue impact returns 401 or 403."""
    r = client.get(f"/api/v1/analysis/revenue-impact/{FAKE_HOTEL_ID}")
    assert r.status_code in (401, 403), (
        f"Expected 401/403, got {r.status_code}: {r.text[:200]}"
    )


# ===========================================================================
# Feature 3 — POST /api/v1/alerts/evaluate/{hotel_id}
# ===========================================================================

def test_alerts_evaluate_requires_auth(client):
    """Unauthenticated alert evaluation returns 401 or 403."""
    r = client.post(f"/api/v1/alerts/evaluate/{FAKE_HOTEL_ID}")
    assert r.status_code in (401, 403), (
        f"Expected 401/403, got {r.status_code}: {r.text[:200]}"
    )


# ===========================================================================
# Feature 4 — POST /api/v1/analysis/whatif
# ===========================================================================

def test_whatif_requires_auth(client):
    """Unauthenticated what-if returns 401 or 403."""
    r = client.post("/api/v1/analysis/whatif", json={
        "hotel_id": FAKE_HOTEL_ID,
        "scenario": "What if I raise my Standard Room by 300 TRY?",
    })
    assert r.status_code in (401, 403), (
        f"Expected 401/403, got {r.status_code}: {r.text[:200]}"
    )


def test_whatif_rejects_short_scenario(client):
    """What-if with a 1-character scenario should return 400 or 401/403 (not 500)."""
    r = client.post("/api/v1/analysis/whatif", json={
        "hotel_id": FAKE_HOTEL_ID,
        "scenario": "x",
    })
    # Either caught by auth (401/403) or by validation (400/422) - never 500
    assert r.status_code in (400, 401, 403, 422), (
        f"Expected validation/auth error, got {r.status_code}: {r.text[:200]}"
    )


# ===========================================================================
# Feature 6 — Annotations CRUD
# ===========================================================================

def test_get_annotations_requires_auth(client):
    """GET annotations requires auth."""
    r = client.get(f"/api/v1/hotels/{FAKE_HOTEL_ID}/annotations")
    assert r.status_code in (401, 403), (
        f"Expected 401/403, got {r.status_code}: {r.text[:200]}"
    )


def test_post_annotation_requires_auth(client):
    """POST annotation requires auth."""
    r = client.post(
        f"/api/v1/hotels/{FAKE_HOTEL_ID}/annotations",
        json={"note": "Test annotation note", "annotation_type": "general"},
    )
    assert r.status_code in (401, 403), (
        f"Expected 401/403, got {r.status_code}: {r.text[:200]}"
    )


def test_meeting_prep_requires_auth(client):
    """Meeting prep endpoint requires auth."""
    r = client.post(f"/api/v1/hotels/{FAKE_HOTEL_ID}/annotations/meeting-prep")
    assert r.status_code in (401, 403), (
        f"Expected 401/403, got {r.status_code}: {r.text[:200]}"
    )


# ===========================================================================
# Pre-existing route smoke tests (regression guard)
# ===========================================================================

def test_discovery_semantic_route_exists(client):
    """The semantic discovery route we built exists (returns 401/403, not 404)."""
    r = client.get(f"/api/v1/discovery/{FAKE_HOTEL_ID}/semantic")
    assert r.status_code in (401, 403), (
        f"Discovery route missing or crashing: {r.status_code}: {r.text[:200]}"
    )


def test_intelligence_brief_route_exists(client):
    """The intelligence brief route exists (returns 401/403, not 404)."""
    r = client.get(f"/api/v1/analysis/intelligence-brief/{FAKE_HOTEL_ID}")
    assert r.status_code in (401, 403), (
        f"Intelligence brief route missing: {r.status_code}: {r.text[:200]}"
    )
