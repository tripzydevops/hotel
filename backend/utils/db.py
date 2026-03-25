# V28_LEGACY_IP_BRIDGE: 2026-03-25T20:55:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import httpx
import traceback

load_dotenv()

def get_supabase_client(jwt: Optional[str] = None) -> Optional[Client]:
    # V28: REGIONAL POD ROUTING + RLS COMPATIBILITY
    auth_url = "https://pa5riyqv.eu-central.insforge.app"
    rest_url = "https://pa5riyqv.eu-central.insforge.app"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163" 
    
    try:
        http_client = httpx.Client(verify=False)
        
        supabase: Client = create_client(
            rest_url, 
            key, 
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10,
                http_client=http_client
            )
        )
        
        # If a JWT is provided, we Must attach it to the client for RLS to work on the pod
        if jwt:
            supabase.postgrest.auth(jwt)
            
        return supabase
    except Exception as e:
        print(f"[V28] FAIL: {e}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail="Database client failed to initialize. (V28: Infrastructure Deadlock Encountered)"
        )
    return client
