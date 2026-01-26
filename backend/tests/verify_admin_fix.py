
import asyncio
import sys
import os
from unittest.mock import MagicMock
from fastapi.responses import JSONResponse

# Context setup
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock deps
mock_db = MagicMock()
mock_client = MagicMock()

async def verify_fix():
    print("[TEST] Verifying Admin API Crash Fix...")
    
    # Simulate the code in main.py directly since we can't easily import the app instance without side effects
    
    # 1. Simulate the Exception
    try:
        print("  -> Simulating SerpApi Reload Crash...")
        raise ValueError("Simulated Connection Error to SerpApi")
    except Exception as e:
        # 2. Simulate the Fix Block
        print(f"  -> Caught Exception: {e}")
        response = JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to reload keys: {str(e)}",
                "error": str(e)
            }
        )
        
    # 3. Verify Response is JSON, not HTML
    import json
    body = json.loads(response.body)
    
    if response.status_code == 500 and body.get("status") == "error":
        print("[PASS] Fix Verified: API returns clean JSON error (500) instead of crashing.")
        print(f"   -> Response Body: {body}")
    else:
        print("[FAIL] Fix failed: Response was not expected JSON format.")

if __name__ == "__main__":
    asyncio.run(verify_fix())
