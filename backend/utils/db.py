# V28_TRACEBACK_BRIDGE: 2026-03-25T21:20:00Z
import os
from typing import Optional, Any
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import httpx
import traceback

load_dotenv()

# DIAGNOSTIC STORAGE
LAST_ERROR = "No error recorded yet."

def dns_bypass_hook(request):
    if request.url.host == "api.insforge.dev":
        request.url = request.url.copy_with(host="3.13.63.83")
        request.headers["Host"] = "api.insforge.dev"

def get_supabase_client(jwt: Optional[str] = None) -> Any:
    global LAST_ERROR
    url = "https://api.insforge.dev"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163" 
    
    try:
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
        LAST_ERROR = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail=f"V28.7_DIAGNOSTIC: {LAST_ERROR}"
        )
    return client
