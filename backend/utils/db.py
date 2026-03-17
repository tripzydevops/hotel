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


def get_supabase() -> Client:
    """
    Default database dependency.
    By default returns an admin client (Service Role).
    USE WITH CAUTION: This bypasses RLS.
    """
    return get_supabase_client()


def get_supabase_client(jwt: str | None = None) -> Client:
    """
    Dependency to provide a Supabase client.
    Optionally accepts a JWT to enable Row-Level Security (RLS).
    If no JWT is provided, it uses SERVICE_ROLE_KEY (admin access).
    """
    raw_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not raw_url:
        raise RuntimeError("[DATABASE] CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing!")
        
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
        anon_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not anon_key:
            raise RuntimeError("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing")
        opts = ClientOptions(headers={"Authorization": f"Bearer {jwt}"})
        client = create_client(url, anon_key, options=opts)
        client.postgrest.auth(jwt)
        # Fix InsForge path issue: supabase-py appends /rest/v1 by default
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        # Ensure Auth client also uses the correct base path
        client.auth._url = f"{url}/api/auth"
        return client

    # Admin access using Service Role Key
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not service_key:
        service_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not service_key:
         raise RuntimeError("No Supabase key found (SERVICE_ROLE or ANON)")

    try:
        if os.getenv("DEBUG_DB") == "1":
            print(f"[DATABASE] Initializing client for {url}")
        client = create_client(url, service_key)
        client.postgrest.base_url = URL(f"{url}/api/database/records/")
        client.auth._url = f"{url}/api/auth"
        return client
    except Exception as e:
        print(f"[DATABASE] CRITICAL: Initialization failed: {str(e)}")
        raise e



