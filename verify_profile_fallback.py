import asyncio
from uuid import uuid4
from backend.api.profile_routes import get_profile
from fastapi import HTTPException

async def verify_profile_fallback():
    print("Running verification: get_profile with db=None")
    
    try:
        user_id = uuid4()
        # Call get_profile directly with db=None
        # Note: In real app, Depends(get_supabase) would verify db not None, but we added check in function too
        
        result = await get_profile(user_id=user_id, db=None)
        
        if result.display_name == "Demo User":
            print("SUCCESS: Got fallback 'Demo User' profile.")
        else:
            print(f"FAIL: Unexpected profile data: {result.display_name}")
            
    except HTTPException as e:
        print(f"FAIL: Caught unexpected HTTPException: {e.status_code} - {e.detail}")
    except Exception as e:
        print(f"FAIL: Caught unexpected exception: {type(e)} - {e}")

if __name__ == "__main__":
    asyncio.run(verify_profile_fallback())
