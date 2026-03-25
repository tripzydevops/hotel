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
    # HARD-FORCED REMEDIATION V6 (ABSOLUTE HARDCODE)
    # Bypassing os.getenv to ensure the build environment doesn't mangle keys.
    url = "https://pa5riyqv.insforge.site"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIwNDB9.H4Unbw_QgpvcAV-qytM9WUkk0s74So1Dnj318lt_2ZQ"
    
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
