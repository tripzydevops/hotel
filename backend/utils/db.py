"""
Shared database utilities and dependencies.
Provides the Supabase client and consistent auth helpers.
REDEPLOY TRIGGER: 2026-03-17T11:58:00Z
"""

import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

# load_dotenv() is called in main.py, but we keep it here as a safety for standalone util usage
load_dotenv()

def get_supabase_client() -> Optional[Client]:
    """
    EXPLANATION: Supabase Client Factory with Vercel/InsForge Patching
    
    1. Direct Supabase: Uses NEXT_PUBLIC_SUPABASE_URL (e.g., xyz.supabase.co)
    2. Vercel Loop Protection: If URL is the Vercel app itself, it force-patches 
       to the .insforge.site proxy to avoid infinite request loops.
    """
    raw_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    url = raw_url
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("[DB] CRITICAL: Supabase environment variables missing.")
        return None

    # EXPLANATION: The 'Vercel Loop' Nuclear Option
    # If the URL is set to the same origin (Vercel), database calls will loop back 
    # to Vercel and 404. We hard-patch to the stable InsForge proxy to bridge this.
    if url and (".vercel.app" in url.lower() or "localhost" in url.lower()):
        # Hardcoded project ID discovered from 'lastResult.baseUrl'
        project_id = "pa5riyqv"
        region = "eu-central"
        url = f"https://{project_id}.{region}.insforge.site"
        print(f"[DB] Loop Protection triggered: {raw_url} -> {url}")

    try:
        # KAİZEN: Standard String Manipulation vs fragile 'yarl' dependency
        # Vercel builds often fail on native C-extensions like yarl if not pinned correctly.
        client = create_client(url, key)
        
        client = create_client(url, key)
        return client
    except Exception as e:
        print(f"[DB] Client Initialization Failed: {e}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize. Check environment variables.")
    return client
