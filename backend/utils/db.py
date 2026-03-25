# V28_TRANSPORT_BRIDGE_STABLE: 2026-03-25T21:12:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import httpx
import traceback

load_dotenv()

def get_supabase_client(jwt: Optional[str] = None) -> Optional[Client]:
    # V28: GLOBAL TRANSPORT BRIDGE (SNI-AWARE)
    target_ip = "3.13.63.83" # api.insforge.dev Ingress
    domain = "api.insforge.dev"
    url = f"https://{domain}"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163" 
    
    try:
        # SNI-AWARE PROXY: We tell httpx to connect to the IP 
        # but keep the Host header and SNI identification as the domain.
        # This is the industry-standard way to bypass DNS partitions.
        http_client = httpx.Client(
            base_url=f"https://{target_ip}", # Connect to IP
            headers={"Host": domain},        # Route to Domain
            verify=False,
            timeout=20.0
        )
        
        supabase: Client = create_client(
            url, # Use the REAL domain here so SDK paths are correct
            key, 
            options=ClientOptions(
                postgrest_client_timeout=20,
                storage_client_timeout=20,
                http_client=http_client
            )
        )
        
        if jwt:
            supabase.postgrest.auth(jwt)
            
        return supabase
    except Exception as e:
        # Log to stderr so it shows up in Vercel/Terminal logs
        import sys
        print(f"[V28] BRIDGE FAIL: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail="Database client failed to initialize. (V28: Transport Bridge Seizure)"
        )
    return client
