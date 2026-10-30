
import sys
import os
import asyncio
from typing import Optional, Dict, Any, List
from unittest.mock import MagicMock, patch

# Add project root to sys.path to allow imports from backend.*
sys.path.append(os.getcwd())

# Import the provider we want to test
from backend.services.providers.dataforseo_provider import DataForSEOProvider
from backend.utils.logger import get_logger

logger = get_logger(__name__)

async def verify_identity_protection():
    """
    Legitimized Identity Protection Verification System.
    Tests matching and leakage prevention using real-world identifiers for Hilton and Altın Otel.
    """
    print("🚀 Initializing Legitimized Identity Protection Verification...")
    
    # Set dummy env vars for initialization
    os.environ["DATAFORSEO_LOGIN"] = "test_user"
    os.environ["DATAFORSEO_PASSWORD"] = "test_pass"
    
    provider = DataForSEOProvider()
    
    # Legitimate Identifiers from backend/tests/sync_ids.py
    HILTON_ID = "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE"
    ALTIN_OTEL_ID = "ChkI0NXi76z7rL9FGg0vZy8xMWMxOTBwMWo4EAE"
    
    # Mock Data for Hilton Garden Inn Balikesir
    hilton_data = {
        "hotel_identifier": HILTON_ID,
        "title": "Hilton Garden Inn Balikesir",
        "prices": {
            "price": 4093.0,
            "currency": "TRY",
            "items": [{"source": "Hilton.com", "price": 4093.0}]
        }
    }
    
    # Mock Data for Altın Otel (with Turkish character in identity mapping)
    altin_data = {
        "hotel_identifier": ALTIN_OTEL_ID,
        "title": "Altin Otel Balikesir",  # Provider often returns normalized names
        "prices": {
            "price": 1200.0,
            "currency": "TRY",
            "items": [{"source": "Booking.com", "price": 1200.0}]
        }
    }
    
    # Random Competitor to test Leakage
    ramada_data = {
        "hotel_identifier": "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB",
        "title": "Ramada Residences By Wyndham Balikesir",
        "prices": {"price": 2500.0, "currency": "TRY", "items": []}
    }

    def create_mock_response(items):
        return {
            "status_code": 20000,
            "tasks": [{
                "status_code": 20000,
                "result": [{"items": items}],
                "data": {"tag": "verification_task"}
            }]
        }

    async def run_scenario(name, mock_items, target_token=None, target_name=None, expected_title=None):
        print(f"\n--- Scenario: {name} ---")
        if target_token: print(f"Targeting Token: {target_token[:10]}...")
        if target_name: print(f"Targeting Name: {target_name}")
        
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = MagicMock()
            mock_get.return_value = mock_resp
            mock_resp.json.return_value = create_mock_response(mock_items)
            
            # Note: We test get_task_result as it's the entry point that handles matching
            res = await provider.get_task_result("task_verify", target_token=target_token, target_name=target_name)
            
            if expected_title:
                if res and res.get("hotel_name") == expected_title:
                    print(f"✅ PASS: Correctly identified {expected_title}")
                    return True
                else:
                    actual = res.get("hotel_name") if res else "None (Blocked)"
                    print(f"❌ FAIL: Expected {expected_title}, got {actual}")
                    return False
            else:
                if res is None:
                    print(f"✅ PASS: Correctly blocked unauthorized identity match (Leakage Prevention)")
                    return True
                else:
                    print(f"❌ FAIL: LEAKAGE! Attributed data to {res.get('hotel_name')}")
                    return False

    success_count = 0
    total_scenarios = 0

    # Test Scenarios
    
    # 1. Exact Token Match (Hilton)
    total_scenarios += 1
    if await run_scenario("Exact Token Match (Hilton)", [hilton_data, ramada_data], target_token=HILTON_ID, expected_title="Hilton Garden Inn Balikesir"):
        success_count += 1

    # 2. Fuzzy Name Match with Turkish Normalization (Altın Otel)
    # Testing "Altın Otel" (with dotless i) vs "Altin Otel" (in data)
    total_scenarios += 1
    if await run_scenario("Turkish Char Normalization (Altın Otel)", [altin_data], target_name="Altın Otel", expected_title="Altin Otel Balikesir"):
        success_count += 1

    # 3. Identity Protection (Leakage Blocking)
    # Search for Altın Otel, but DataForSEO only returns Ramada
    total_scenarios += 1
    if await run_scenario("Leakage Blocking (Search mismatch)", [ramada_data], target_name="Altın Otel", expected_title=None):
        success_count += 1

    print("\n" + "="*40)
    print(f"Final Outcome: {success_count}/{total_scenarios} Scenarios Passed")
    print("="*40)
    
    if success_count == total_scenarios:
        print("🎉 Identity Protection Verified as Legitimate and Robust.")
    else:
        print("⚠️ Component failure detected in Identity Protection layer.")

if __name__ == "__main__":
    asyncio.run(verify_identity_protection())
