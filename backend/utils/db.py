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
    raw_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not raw_url:
        print("[DATABASE] CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing!")
        return None
        
    # Clean up URL: InsForge often appends paths to this in .env which breaks the SDK
    url = raw_url.split("/api/")[0].rstrip("/")

    if jwt:
        # Use simple Anon Key + User JWT to enforce RLS
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        opts = ClientOptions(headers={"Authorization": f"Bearer {jwt}"})
        client = create_client(url, key, options=opts)
        client.postgrest.auth(jwt)
        # Fix InsForge path issue: supabase-py appends /rest/v1 by default
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        # Ensure Auth client also uses the correct base path
        client.auth._url = f"{url}/api/auth"
        return client

    # Admin access using Service Role Key
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    try:
        if os.getenv("DEBUG_DB") == "1":
            print(f"[DATABASE] Initializing client for {url}")
        client = create_client(url, key)
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        client.auth._url = f"{url}/api/auth"
        return client
    except Exception as e:
        print(f"[DATABASE] CRITICAL: Initialization failed: {str(e)}")
        return None


async def get_async_supabase_client(jwt: str | None = None) -> Client | None:
    """
    Async dependency to provide a Supabase client.
    Enables true non-blocking concurrent queries (asyncio.gather).
    """
    from supabase import acreate_client, AsyncClient
    
    raw_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not raw_url:
        return None
        
    url = raw_url.split("/api/")[0].rstrip("/")

    if jwt:
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        client: AsyncClient = await acreate_client(url, key, options=ClientOptions(headers={"Authorization": f"Bearer {jwt}"}))
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        client.auth._url = f"{url}/api/auth"
        return client

    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    try:
        client: AsyncClient = await acreate_client(url, key)
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        client.auth._url = f"{url}/api/auth"
        return client
    except Exception as e:
        print(f"[DATABASE] Async Initialization failed: {str(e)}")
        return None
