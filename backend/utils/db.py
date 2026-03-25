"""
Shared database utilities and dependencies.
Provides the Supabase client and consistent auth helpers.
REDEPLOY TRIGGER: 2026-03-25T14:26:00Z
"""

import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

# load_dotenv() is called in main.py, but we keep it here as a safety for standalone util usage
load_dotenv()

def get_supabase_client() -> Optional[Client]:
    # HARD-FORCED REMEDIATION V9 (SERVICE ROLE ELEVATION)
    # The Python backend acts as an administrator and MUST use the Service Role Key
    # to bypass RLS on system tables like 'landing_config'.
    url = "https://pa5riyqv.eu-central.insforge.app"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    if not key:
        print("[DB] CRITICAL: Supabase Key missing.")
        return None

    try:
        # Standard initialization with the hard-coded stable proxy
        client = create_client(url, key)
        return client
    except Exception as e:
        print(f"[DB] Client Initialization Failed: {e}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize. Check environment variables.")
    return client
