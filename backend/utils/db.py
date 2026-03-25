# V19_FORCE_SYNC: 2026-03-25T18:28:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

load_dotenv()

def get_supabase_client() -> Optional[Client]:
    # V25: DUAL-GATEWAY RECOVERY
    # Auth @ api.insforge.dev (Verified JSON)
    # Data @ pa5riyqv.insforge.site (Verified REST)
    auth_url = "https://api.insforge.dev"
    rest_url = "https://pa5riyqv.insforge.site"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    try:
        from supabase import create_client, ClientOptions
        opts = ClientOptions(
            postgrest_url=f"{rest_url}/rest/v1",
            gotrue_url=f"{auth_url}/auth/v1"
        )
        # The base URL is required but overridden by options
        client = create_client(rest_url, key, options=opts)
        return client
    except Exception as e:
        print(f"[DB] Allocation Failure: {e}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize.")
    return client
