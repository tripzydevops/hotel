# V18_FORCE_SYNC: 2026-03-25T18:18:00Z
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
        "https://pa5riyqv.eu-central.insforge.site",
        "https://c6db35ac-d7e6-43a4-956d-ad71853f0b3b.eu-central.insforge.site"
    ]
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    import httpx
    import time
    
    winner = gateways[0] # Default
    for gw in gateways:
        try:
            # V16: DUAL-SERVICE PROBE
            # We must ensure BOTH Auth and REST are alive on the gateway.
            # Some gateways in this environment are "split" (Auth works, REST 404s).
            auth_resp = httpx.get(f"{gw}/auth/v1/health", timeout=2.0)
            rest_resp = httpx.get(f"{gw}/rest/v1/", timeout=2.0)
            
            if auth_resp.status_code == 200 and rest_resp.status_code in [200, 301, 302, 401]:
                # 401 is actually a "pass" for REST if we don't have keys in the probe
                print(f"[DB] FULL SERVICE Winner Found: {gw}")
                winner = gw
                break
            
            # Special case for cold starts
            if auth_resp.status_code == 503:
                time.sleep(1)
                auth_resp = httpx.get(f"{gw}/auth/v1/health", timeout=5.0)
                rest_resp = httpx.get(f"{gw}/rest/v1/", timeout=5.0)
                if auth_resp.status_code == 200 and rest_resp.status_code in [200, 301, 302, 401]:
                    winner = gw
                    break
        except Exception as e:
            print(f"[DB] Gateway {gw} Failed Probe: {e}")
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
