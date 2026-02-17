import asyncio
from backend.services.dashboard_service import get_dashboard_logic
from fastapi import HTTPException

async def test_dashboard_fail_on_none_db():
    print("Running reproduction test: get_dashboard_logic with db=None")
    
    try:
        # Mock user data
        await get_dashboard_logic(
            user_id="test_user",
            current_user_id="test_user",
            current_user_email="test@example.com",
            db=None  # Simulate failed DB connection
        )
        print("FAIL: Function should have raised HTTPException 500")
    except HTTPException as e:
        print(f"SUCCESS: Caught expected HTTPException: {e.status_code} - {e.detail}")
    except Exception as e:
        print(f"FAIL: Caught unexpected exception: {type(e)} - {e}")

if __name__ == "__main__":
    asyncio.run(test_dashboard_fail_on_none_db())
