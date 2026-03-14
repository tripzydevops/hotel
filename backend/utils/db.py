"""
Shared database utilities and dependencies.
Provides the Supabase client and consistent auth helpers.
"""

from fastapi import Depends
import os
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from yarl import URL

load_dotenv()


def get_supabase() -> Client:
    """
    Default database dependency.
    By default returns an admin client (Service Role).
    USE WITH CAUTION: This bypasses RLS.
    """
    return get_supabase_client()


def get_supabase_client(jwt: str | None = None) -> Client | None:
    """
    Dependency to provide a Supabase client.
    Optionally accepts a JWT to enable Row-Level Security (RLS).
    If no JWT is provided, it uses SERVICE_ROLE_KEY (admin access).
    """
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    if jwt:
        # Use simple Anon Key + User JWT to enforce RLS
        # Setting headers explicitly to ensure Postgrest picks up the RLS context correctly
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        opts = ClientOptions(headers={"Authorization": f"Bearer {jwt}"})
        client = create_client(url, key, options=opts)
        client.postgrest.auth(jwt)
        # Fix InsForge path issue: supabase-py appends /rest/v1 by default
        # We must use /api/database/records/ for InsForge compatibility
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        return client

    # Admin access using Service Role Key
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("[DATABASE] ERROR: SUPABASE_SERVICE_ROLE_KEY not found in environment.")
        # Fallback to anon key is dangerous but allowed here for dev consistency
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url:
        print("[DATABASE] CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing!")
        return None
        
    if not key:
        print("[DATABASE] CRITICAL: SUPABASE_SERVICE_ROLE_KEY and ANON_KEY are both missing!")
        return None

    try:
        if os.getenv("DEBUG_DB") == "1":
            print(f"[DATABASE] Initializing client for {url}")
        client = create_client(url, key)
        # Fix InsForge path issue: supabase-py appends /rest/v1 by default
        # We must use /api/database/records/ for InsForge compatibility
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        return client
    except Exception as e:
        print(f"[DATABASE] CRITICAL: Initialization failed: {str(e)}")
        return None
