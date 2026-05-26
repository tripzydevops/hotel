import sys
from unittest.mock import MagicMock

# Proactively mock heavy dependencies to prevent ImportErrors in the test environment
sys.modules['pandas'] = MagicMock()
sys.modules['psutil'] = MagicMock()

import pytest
from fastapi.testclient import TestClient
from backend.main import app

def test_cors_whitelisted_origins():
    """Verify that only authorized whitelisted origins are set in CORS headers."""
    client = TestClient(app)
    
    # 1. Test whitelisted production origin
    headers = {"Origin": "https://hotelplustr.com"}
    response = client.get("/api/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://hotelplustr.com"
    assert response.headers.get("access-control-allow-credentials") == "true"
    
    # 2. Test whitelisted staging origin
    headers = {"Origin": "https://pa5riyqv.eu-central.insforge.app"}
    response = client.get("/api/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://pa5riyqv.eu-central.insforge.app"
    assert response.headers.get("access-control-allow-credentials") == "true"
    
    # 3. Test non-whitelisted/malicious origin
    headers = {"Origin": "https://evil-hacker.com"}
    response = client.get("/api/health", headers=headers)
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
    assert "access-control-allow-credentials" not in response.headers
    
    # 4. Test request with no Origin header
    response = client.get("/api/health")
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
