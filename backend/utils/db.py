# Supabase/PostgREST Database Utility
import os
# from yarl import URL # Removed for Vercel portability
from typing import Optional, Any
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import traceback

def load_env_standard():
    """
    Standardize environment variable loading for both App and CLI scripts.
    Prioritizes .env.local for development compatibility.
    """
    load_dotenv(".env")
    load_dotenv(".env.local", override=True)

# Initial load for app-level execution
load_env_standard()

def get_supabase_client(jwt: Optional[str] = None, admin: bool = False) -> Optional[Client]:
    """
    Returns a configured Supabase client.
    
    If admin=True, it uses the SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
    If jwt is provided, it returns a client scoped to that user (honors RLS).
    """
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") if admin else os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        return None
        
    # Standard header-based authentication for RLS
    options = ClientOptions().replace(
        auto_refresh_token=False,
        persist_session=False
    )
    
    try:
        supabase = create_client(url, key, options=options)
        
        if jwt:
            supabase.postgrest.auth(jwt)
            
        # Configure base URL for database operations.
        from yarl import URL
        clean_base = url.rstrip("/")
        supabase.postgrest.base_url = URL(f"{clean_base}/api/database/records")
            
        return supabase
    except Exception as e:
        # Avoid crashing the script during initialization; let the caller handle the None result
        print(f"CRITICAL_DB_INIT_FAILED: {str(e)}")
        traceback.print_exc()
        return None

def get_supabase_dependency(client: Optional[Client] = Depends(get_supabase_client)):
    """FastAPI dependency for Supabase with automatic 500 on failure."""
    if not client:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail="DATABASE_INIT_FAILED: Please check connection pool status."
        )
    return client

# Alias for backward compatibility with existing code (Functions and Dependencies)
get_supabase = get_supabase_client
