# V28_INGRESS_BRIDGE_STABLE: 2026-03-25T21:08:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import httpx
import traceback

load_dotenv()

def get_supabase_client(jwt: Optional[str] = None) -> Optional[Client]:
    # V28: GLOBAL INGRESS BRIDGE
    # We use the direct IP of the AWS ELB that serves api.insforge.dev
    # to bypass the Vercel .dev DNS partition.
    target_ip = "3.13.63.83" 
    host_header = "api.insforge.dev"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163" 
    
    try:
        # We manually configure the httpx client to talk to the IP
        # but present the Host header for the ALB to route correctly.
        # SSL Verification is disabled because the cert is for a domain, not an IP.
        http_client = httpx.Client(
            base_url=f"https://{target_ip}",
            headers={"Host": host_header},
            verify=False,
            timeout=10.0
        )
        
        # We must also ensure the SDK uses the IP-based base URL
        supabase: Client = create_client(
            f"https://{target_ip}", 
            key, 
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10,
                http_client=http_client
            )
        )
        
        if jwt:
            supabase.postgrest.auth(jwt)
            
        return supabase
    except Exception as e:
        print(f"[V28] INGRESS FAIL: {e}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail="Database client failed to initialize. (V28: Global Ingress Partitioned)"
        )
    return client
