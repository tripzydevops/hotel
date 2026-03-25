# V28_ISOLATION_BRIDGE_FINAL: 2026-03-25T21:26:00Z
import os
from typing import Optional, Any
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import httpx
import traceback

load_dotenv()

LAST_ERROR = "No errors caught in V28.8 yet."

def get_supabase_client(jwt: Optional[str] = None) -> Any:
    global LAST_ERROR
    # DIRECT IP TARGETING: Bypass DNS at the SDK level
    target_ip = "3.13.63.83"
    url = f"https://{target_ip}"
    host_domain = "api.insforge.dev"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163" 
    
    try:
        # We use a client that forces the Host header for the IP target
        http_client = httpx.Client(
            verify=False,
            timeout=30.0,
            headers={"Host": host_domain}
        )
        
        supabase: Client = create_client(
            url, 
            key, 
            options=ClientOptions(
                postgrest_client_timeout=30,
                storage_client_timeout=30,
                http_client=http_client
            )
        )
        
        if jwt:
            supabase.postgrest.auth(jwt)
            
        return supabase
    except Exception as e:
        LAST_ERROR = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail=f"V28.8_ERROR: {LAST_ERROR}"
        )
    return client
