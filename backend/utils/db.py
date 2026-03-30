# PRODUCTION_READY: 2026-03-27T10:40:00Z
import os
from yarl import URL
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

def get_supabase_client(url: Optional[str] = None, key: Optional[str] = None, jwt: Optional[str] = None, admin: bool = False) -> Any:
    """
    Core Supabase client factory with InsForge-specific path overrides.
    Safe for both FastAPI dependency injection and standalone script usage.
    """
    # 1. Prioritize arguments, then env vars
    target_url = url or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if admin:
        target_key = key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    else:
        target_key = key or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not target_url or not target_key:
        print(f"CRITICAL: Missing Supabase credentials (URL={bool(target_url)}, KEY={bool(target_key)}, ADMIN={admin})")
        return None


    try:
        # 2. Initialize the generic client
        supabase: Client = create_client(
            target_url, 
            target_key, 
            options=ClientOptions(
                postgrest_client_timeout=30,
                storage_client_timeout=30
            )
        )
        
        # 3. Path Redirection: Override default PostgREST path for InsForge compatability
        # Use yarl for safe URL manipulation (avoids double-slash or missing slash issues)
        base = URL(target_url)
        supabase.postgrest.base_url = base / "api/database/records"
        
        if jwt:
            supabase.postgrest.auth(jwt)
            
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
