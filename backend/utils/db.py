# PRODUCTION_READY: 2026-03-27T10:40:00Z
import os
from typing import Optional, Any
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import traceback

load_dotenv()

def get_supabase_client(jwt: Optional[str] = None, admin: bool = False) -> Any:
    # InsForge Data Plane: eu-central cluster via .app TLD
    # The .app domain is the stable data-plane endpoint for PostgREST/Auth.
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "https://pa5riyqv.eu-central.insforge.app"
    # PostgREST requires a valid API key in the 'apikey' header.
    # Prefer service role key, fall back to anon key for public reads.
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    
    try:
        supabase: Client = create_client(
            url, 
            key, 
            options=ClientOptions(
                postgrest_client_timeout=30,
                storage_client_timeout=30
            )
        )
        
        if jwt:
            supabase.postgrest.auth(jwt)
            
        return supabase
    except Exception as e:
        # Fallback to local error tracking for debug
        print(f"CRITICAL_DB_INIT_FAILED: {str(e)}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail="DATABASE_INIT_FAILED: Please check connection pool status."
        )
    return client
