# V19_FORCE_SYNC: 2026-03-25T18:28:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

load_dotenv()

def get_supabase_client() -> Optional[Client]:
    # V27: ABSOLUTE PATH RESTORATION
    auth_url = "https://pa5riyqv.eu-central.insforge.app"
    rest_url = "https://pa5riyqv.eu-central.insforge.app"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    import traceback
    # V28_LEGACY_IP_BRIDGE
    ip_address = "52.29.21.196"
    host_header = "pa5riyqv.eu-central.insforge.app"
    
    try:
        import httpx
        from supabase import create_client, ClientOptions
        
        # Bypass Vercel Lambda DNS failure by using direct IP + Host Header
        # Note: verify=False is required as the SSL cert SNI won't match the IP
        http_client = httpx.Client(verify=False)
        opts = ClientOptions(
            http_client=http_client,
            headers={"Host": host_header}
        )
        
        client = create_client(f"https://{ip_address}", key, options=opts)
        return client
    except Exception as e:
        import traceback
        with open("/tmp/backend_error.log", "a") as f:
            f.write(f"CRITICAL ALLOCATION FAILURE: {str(e)}\n")
            f.write(traceback.format_exc())
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize. (V27 Diagnostics: Paths Mismatch Possible)")
    return client
