import asyncio
from backend.services.dashboard_service import get_dashboard_logic
from fastapi import HTTPException

async def verify_dashboard_fallback():
    print("Running verification: get_dashboard_logic with db=None")
    
    try:
        # Mock user data
        result = await get_dashboard_logic(
            user_id="test_user",
            current_user_id="test_user",
            current_user_email="test@example.com",
            db=None
        )
        
        if result.get("error") == "Database Unavailable":
            print("SUCCESS: Got fallback data with correct error message.")
            print(f"Keys returned: {list(result.keys())}")
        else:
            print(f"FAIL: Did not get expected error message. Got: {result.get('error')}")
            
    except HTTPException as e:
        print(f"FAIL: Caught unexpected HTTPException: {e.status_code} - {e.detail}")
    except Exception as e:
        print(f"FAIL: Caught unexpected exception: {type(e)} - {e}")

if __name__ == "__main__":
    asyncio.run(verify_dashboard_fallback())
