# V19_FORCE_SYNC: 2026-03-25T18:28:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

load_dotenv()

def get_supabase_client() -> Optional[Client]:
    # V19: DUAL-SERVICE PROBE
    gateways = [
        "https://pa5riyqv.eu-central.insforge.app",
        "https://c6db35ac-d7e6-43a4-956d-ad71853f0b3b.eu-central.insforge.app"
    ]
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    import httpx
    import time
    
    winner = gateways[0] 
    for gw in gateways:
        try:
            # We must probe BOTH Auth and REST
            auth_resp = httpx.get(f"{gw}/auth/v1/health", timeout=2.0)
            rest_resp = httpx.get(f"{gw}/rest/v1/", timeout=2.0)
            
            if auth_resp.status_code == 200 and rest_resp.status_code in [200, 301, 302, 401]:
                print(f"[DB] FULL SERVICE Winner Found: {gw}")
                winner = gw
                break
        except Exception as e:
            continue

    try:
        client = create_client(winner, key)
        return client
    except Exception:
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize.")
    return client
