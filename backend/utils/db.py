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
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("[DB] CRITICAL: Supabase environment variables missing.")
        return None

    try:
        # KAİZEN: Standard String Manipulation vs fragile 'yarl' dependency
        # Vercel builds often fail on native C-extensions like yarl if not pinned correctly.
        client = create_client(url, key)
        
        # EXPLANATION: The 'InsForge Proxy' Redirect Logic
        # On InsForge environments, we MUST route database calls through the 
        # .insforge.site proxy (which handles Auth and Multi-tenancy). 
        # If the URL points to .vercel.app, we assume it's the internal loop and redirect.
        if url and ".vercel.app" in url.lower():
            # Robust replacement: pa5riyqv.eu-central.insforge-app.vercel.app -> pa5riyqv.eu-central.insforge.site
            proxy_url = url.replace("-app.vercel.app", ".insforge.site").replace(".vercel.app", ".insforge.site")
            print(f"[DB] Loop detected. Patching base_url: {url} -> {proxy_url}")
            client.postgrest.base_url = proxy_url
            
        return client
    except Exception as e:
        print(f"[DB] Client Initialization Failed: {e}")
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Database client failed to initialize. Check environment variables.")
    return client
