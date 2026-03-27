# PRODUCTION_READY: 2026-03-27T10:40:00Z
import os
from typing import Optional, Any
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends
import traceback

load_dotenv()

def get_supabase_client(jwt: Optional[str] = None) -> Any:
    # InsForge Platform Update: 2026-03-27
    # Infrastructure is now stable via official .dev TLD.
    url = "https://pa5riyqv.insforge.dev"
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "ik_4697b4a8df7380fb98a348d2d8c6d163")
    
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
