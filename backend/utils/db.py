# V19_FORCE_SYNC: 2026-03-25T18:28:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

load_dotenv()

def get_supabase_client() -> Optional[Client]:
    # V27: ABSOLUTE PATH RESTORATION
    auth_url = "https://api.insforge.dev"
    rest_url = "https://pa5riyqv.insforge.site"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    import traceback
    try:
        from supabase import create_client, ClientOptions
        # SDK manual overrides MUST include the API version suffixes
        opts = ClientOptions(
            postgrest_url=f"{rest_url}/rest/v1",
            gotrue_url=f"{auth_url}/auth/v1"
        )
        client = create_client(rest_url, key, options=opts)
        
        # Verify connectivity for REST specifically
        try:
            # We don't execute, just check if the property is initialized
            print(f"[V27] Client Ready. REST: {client.postgrest.url}, Auth: {client.auth.url}")
        except Exception:
            pass
            
        return client
    except Exception as e:
        print(f"[V27] CRITICAL ALLOCATION FAILURE: {e}")
        print(traceback.format_exc())
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize. (V27 Diagnostics: Paths Mismatch Possible)")
    return client
