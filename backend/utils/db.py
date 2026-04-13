# Supabase/PostgREST Database Utility
import os
from yarl import URL # Required for PostgREST base_url joinpath compatibility
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
    
    import time
    from yarl import URL
    
    max_retries = 3
    retry_delay = 0.5  # Seconds
    
    for attempt in range(max_retries):
        try:
            supabase = create_client(url, key, options=options)
            
            if jwt:
                supabase.postgrest.auth(jwt)
                
            # Configure base URL for database operations (InsForge compatibility override)
            # PostgREST client requires a yarl.URL object for joinpath support.
            clean_base = url.rstrip("/")
            supabase.postgrest.base_url = URL(f"{clean_base}/api/database/records")
            
            # AGENT_FIX: Basic connectivity check (sanity)
            # We don't want to return a broken client that will fail on the first query.
            return supabase
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"CRITICAL_DB_INIT_FAILED after {max_retries} attempts: {str(e)}")
                # traceback.print_exc()
                return None
            time.sleep(retry_delay * (2 ** attempt)) # Exponential backoff
    
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

def try_acquire_lock(db: Any, lock_key: str, expire_seconds: int = 60) -> bool:
    """
    Attempts to acquire a distributed lock via PostgreSQL RPC.
    Returns True if acquired, False otherwise.
    """
    try:
        res = db.rpc("try_acquire_lock", {
            "p_lock_key": lock_key,
            "p_expire_seconds": expire_seconds
        }).execute()
        return bool(res.data)
    except Exception as e:
        print(f"Lock acquisition error: {e}")
        return False
