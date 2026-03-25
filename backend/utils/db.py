# V19_FORCE_SYNC: 2026-03-25T18:28:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

load_dotenv()

def get_supabase_client() -> Optional[Client]:
    # V27: ABSOLUTE PATH RESTORATION
    auth_url = "https://pa5riyqv.eu-central.insforge.app"
    rest_url = "https://pa5riyqv.eu-central.insforge.app"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    import traceback
    try:
        from supabase import create_client
        # Standard initialization (SDK appends /rest/v1 and /auth/v1 automatically)
        client = create_client(rest_url, key)
        return client
    except Exception as e:
        import traceback
        with open("/tmp/backend_error.log", "a") as f:
            f.write(f"CRITICAL ALLOCATION FAILURE: {str(e)}\n")
            f.write(traceback.format_exc())
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize. (V27 Diagnostics: Paths Mismatch Possible)")
    return client
