"""
Shared database utilities and dependencies.
Provides the Supabase client and consistent auth helpers.
"""

from fastapi import Depends, HTTPException, Request
import os
import asyncio
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from yarl import URL

load_dotenv()


def get_token(request: Request) -> str:
    """
    Extracts the Bearer token from the Authorization header or query parameter.
    Query parameter 'token' is used as a fallback for SSE (EventSource).
    """
    auth_header = request.headers.get("Authorization")
    if auth_header:
        token_parts = auth_header.split(" ")
        if len(token_parts) == 2 and token_parts[0].lower() == "bearer":
            return token_parts[1]

    # Fallback for SSE / Query Params
    query_token = request.query_params.get("token")
    if query_token:
        return query_token

    raise HTTPException(status_code=401, detail="Missing Authorization Header or Token Query Param")


def get_supabase_rls(
    token: str = Depends(get_token),
) -> Client:
    """
    Dependency that returns a Supabase client with RLS enabled.
    Uses the JWT from the Authorization header.
    """
    return get_supabase_client(jwt=token)


async def get_async_supabase_rls(
    token: str = Depends(get_token),
) -> Client:
    """
    Async dependency that returns a Supabase AsyncClient with RLS enabled.
    """
    return await get_async_supabase_client(jwt=token)


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
        
    # EXPLANATION: Self-Healing Origin (Phase 43)
    # If the environment variable is stale (pointing to the dead .app domain),
    # we automatically switch to the stable .site origin. This resolves 500 errors
    # caused by DNS resolution failures without requiring a manual Vercel dashboard update.
    if "pa5riyqv.eu-central.insforge.app" in raw_url:
        print("[DATABASE] DEBUG: Auto-repairing stale .app origin to .site origin")
        raw_url = "https://pa5riyqv.insforge.site"

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


async def execute_resilient(query_or_coro):
    """
    Helper to handle both sync and async Supabase client results.
    Prevents 'SingleAPIResponse is not awaitable' errors.
    """
    if asyncio.iscoroutine(query_or_coro) or hasattr(query_or_coro, "__await__"):
        return await query_or_coro
    # It's already the result (sync)
    return query_or_coro
