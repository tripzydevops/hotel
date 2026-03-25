# V28_HOOK_BRIDGE_FINAL: 2026-03-25T21:15:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import httpx
import traceback

load_dotenv()

def dns_bypass_hook(request):
    # TRANSPARENT DNS BYPASS
    # We catch the 'api.insforge.dev' request and point it to the global ingress IP
    # while keeping the host header intact for the AWS ALB.
    if request.url.host == "api.insforge.dev":
        request.url = request.url.copy_with(host="3.13.63.83")
        request.headers["Host"] = "api.insforge.dev"

def get_supabase_client(jwt: Optional[str] = None) -> Optional[Client]:
    url = "https://api.insforge.dev"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163" 
    
    try:
        # We hook every request to force the IP mapping
        http_client = httpx.Client(
            verify=False,
            timeout=30.0,
            event_hooks={'request': [dns_bypass_hook]}
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
        import sys
        print(f"[V28.6] HOOK FAIL: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail="Database client failed to initialize. (V28.6: Hook Bridge Failure)"
        )
    return client
