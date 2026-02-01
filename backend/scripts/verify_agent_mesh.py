
import asyncio
import os
from uuid import UUID
from datetime import date
from supabase import create_client
from dotenv import load_dotenv

# Import the orchestrator and schemas
from backend.main import run_monitor_background
from backend.models.schemas import ScanOptions

load_dotenv()
load_dotenv(".env.local", override=True)

async def verify_mesh():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    db = create_client(url, key)

    # Test Data
    user_id = UUID("ae82e4f2-3c0c-45f0-bd8a-0288507a843f") # Existing test user
    test_hotels = [
        {"id": "7fbd4c9c-297c-47fc-8f64-469bfd6a36bc", "name": "Willmont Hotel", "location": "Balikesir", "is_target_hotel": True},
        {"id": "96210f9e-ccb0-48e0-8b65-680456108155", "name": "Onhann Hotel", "location": "Balikesir", "is_target_hotel": False}
    ]
    
    options = ScanOptions(
        check_in=date.today(),
        check_out=date.today(), # Same day for quick check
        adults=1,
        currency="TRY"
    )

    print("--- Starting Agent-Mesh Verification ---")
    await run_monitor_background(
        user_id=user_id,
        hotels=test_hotels,
        options=options,
        db=db,
        session_id=None
    )
    print("--- Verification Complete (Check Logs Above) ---")

if __name__ == "__main__":
    asyncio.run(verify_mesh())
