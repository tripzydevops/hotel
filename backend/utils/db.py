import sys
import os
from typing import Optional, Any
from dotenv import load_dotenv
from fastapi import Depends
import traceback
from backend.utils.logger import get_logger

# EXPLANATION: Module-level logger for consistent behavior
logger = get_logger(__name__)

def load_env_standard() -> None:
    try:
        # Load from multiple potential locations safely
        for env_file in [".env", ".env.local", ".env.production"]:
            if os.path.exists(env_file):
                load_dotenv(env_file, override=True)
    except Exception:
        # Silently continue on Vercel where env vars are injected directly
        pass

# Initial load for app-level execution
load_env_standard()

def get_supabase_client(url: Optional[str] = None, key: Optional[str] = None, jwt: Optional[str] = None, admin: bool = False) -> Any:
    """
    Factory for Supabase Client with path overrides for InsForge.
    Safe for both FastAPI dependency injection and standalone usage.
    """
    from supabase import create_client, Client, ClientOptions
    from yarl import URL

    # EXPLANATION: Environment Lookup
    # In production (Vercel), we expect NEXT_PUBLIC_SUPABASE_URL to be set.
    # For admin tasks, we MUST use SUPABASE_SERVICE_ROLE_KEY instead of ANON_KEY.
    target_url = url or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin:
        target_key = key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not target_key:
            # Fallback for local debugging if role key is missing but anon is present
            target_key = key or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    else:
        target_key = key or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not target_url or not target_key:
        sys.stderr.write(f"CRITICAL: SUPABASE_CONFIG_MISSING - URL: {'SET' if target_url else 'MISSING'}, KEY: {'SET' if target_key else 'MISSING'}\n")
        return None

    try:
        # Resolve any extra slash issues
        target_url = str(target_url).rstrip("/")
        
        supabase: Client = create_client(target_url, target_key, options=ClientOptions(
            postgrest_client_timeout=30,
            storage_client_timeout=30,
            schema="public"
        ))
        
        # 2. Path Overrides for InsForge
        if target_url and "insforge.app" in target_url:
            base = URL(target_url)
            # InsForge-specific REST path
            supabase.postgrest.base_url = base / "api/database/records"
            
        return supabase
    except Exception as e:
        sys.stderr.write(f"CRITICAL: SUPABASE_INIT_ERROR: {str(e)}\n")
        return None


def get_supabase() -> Any:
    """
    Standard, safe function for obtaining a database client.
    Works in scripts, background tasks, AND routes.
    """
    db = get_supabase_client()
    if not db:
        missing = []
        if not os.getenv("NEXT_PUBLIC_SUPABASE_URL"): missing.append("URL")
        if not os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"): missing.append("Key")
        raise RuntimeError(f"DATABASE_CONFIG_ERROR: Missing [{', '.join(missing)}]. Check ENV.")
    return db


def get_supabase_dependency(client: Optional[Any] = None) -> Any:
    """
    FastAPI Dependency wrapper. Calls the factory and handles errors via HTTPException.
    """
    from fastapi import HTTPException
    
    # Use provided client or fetch via factory
    db = client or get_supabase_client()
    
    if not db:
        missing = []
        if not os.getenv("NEXT_PUBLIC_SUPABASE_URL"): missing.append("URL")
        if not os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"): missing.append("Key")
        
        raise HTTPException(
            status_code=503, 
            detail=f"DATABASE_CONFIG_ERROR: Missing [{', '.join(missing)}]. Please check Vercel Environment Variables and Redeploy."
        )
    return db


# EXPLANATION: Backwards compatibility aliases
get_db_session = get_supabase_dependency
get_get_supabase_client = get_supabase_client # Real factory
