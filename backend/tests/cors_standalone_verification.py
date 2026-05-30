import sys
from unittest.mock import MagicMock

# 1. Proactively mock backend.api and all its route submodules in sys.modules
# This completely prevents imports of sse_starlette, pandas, or other heavy modules.
mock_api = MagicMock()
sys.modules['backend.api'] = mock_api
sys.modules['backend.api.v1'] = MagicMock()
sys.modules['backend.api.v1.webhooks'] = MagicMock()
sys.modules['backend.api.v1.webhooks.dataforseo'] = MagicMock()

route_modules = [
    'admin_routes', 'hotel_routes', 'monitor_routes', 'dashboard_routes',
    'reports_routes', 'profile_routes', 'analysis_routes', 'alerts_routes',
    'landing_routes', 'pulse_routes', 'market_routes', 'execution_routes',
    'recovery_routes', 'auth_routes', 'webhook_routes', 'hotel_webhook',
    'signals_routes', 'intelligence_routes'
]
for mod in route_modules:
    sys.modules[f'backend.api.{mod}'] = MagicMock()

# Mock other potentially missing heavy components
sys.modules['backend.services.ai_service'] = MagicMock()
sys.modules['backend.services.retention_service'] = MagicMock()

# 2. Now safely import the main app
from fastapi.testclient import TestClient
from backend.main import app

def run_cors_verification():
    print("=== STARTING STANDALONE CORS VERIFICATION ===")
    client = TestClient(app)
    
    # Test case 1: Whitelisted Production Origin
    print("Testing Production Origin: https://hotelplustr.com")
    headers = {"Origin": "https://hotelplustr.com"}
    response = client.get("/ping", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://hotelplustr.com"
    assert response.headers.get("access-control-allow-credentials") == "true"
    print("  -> PASSED: Access granted successfully.")
    
    # Test case 2: Whitelisted Staging Origin
    print("Testing Staging Origin: https://pa5riyqv.eu-central.insforge.app")
    headers = {"Origin": "https://pa5riyqv.eu-central.insforge.app"}
    response = client.get("/ping", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://pa5riyqv.eu-central.insforge.app"
    assert response.headers.get("access-control-allow-credentials") == "true"
    print("  -> PASSED: Access granted successfully.")
    
    # Test case 3: Non-whitelisted Origin
    print("Testing Unauthorized Origin: https://evil-hacker.com")
    headers = {"Origin": "https://evil-hacker.com"}
    response = client.get("/ping", headers=headers)
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
    assert "access-control-allow-credentials" not in response.headers
    print("  -> PASSED: Origin blocked successfully.")
    
    # Test case 4: Request with no Origin header
    print("Testing Request with No Origin")
    response = client.get("/ping")
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
    print("  -> PASSED: No CORS headers set.")
    
    print("\n=== CORS VERIFICATION COMPLETED: ALL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_cors_verification()
