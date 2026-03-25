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
    # V14: SMART GATEWAY PROBE
    # We probe multiple known gateways to find the healthy one.
    gateways = [
        "https://pa5riyqv.eu-central.insforge.app",
        "https://c6db35ac-d7e6-43a4-956d-ad71853f0b3b.eu-central.insforge.app",
        "https://pa5riyqv.insforge.site"
    ]
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    import httpx
    import time
    
    winner = gateways[0] # Default
    for gw in gateways:
        try:
            # We check the auth health first as it's the most stable endpoint
            resp = httpx.get(f"{gw}/auth/v1/health", timeout=2.0)
            if resp.status_code == 200:
                print(f"[DB] Winner Gateway Found: {gw}")
                winner = gw
                break
            if resp.status_code == 503:
                # Cold start?
                time.sleep(1)
                resp = httpx.get(f"{gw}/auth/v1/health", timeout=5.0)
                if resp.status_code == 200:
                    winner = gw
                    break
        except Exception:
            continue

    try:
        client = create_client(winner, key)
        return client
    except Exception as e:
        print(f"[DB] Client Initialization Failed: {e}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize. Check environment variables.")
    return client
