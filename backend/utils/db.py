"""
Shared database utilities and dependencies.
Provides the Supabase client and consistent auth helpers.
"""

from fastapi import Depends
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


def get_supabase() -> Client:
    """
    Default database dependency.
    By default returns an admin client (Service Role).
    USE WITH CAUTION: This bypasses RLS.
    """
    return get_supabase_client()


def get_supabase_client(jwt: str = None) -> Client:
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
        client = create_client(url, key, options={"headers": {"Authorization": f"Bearer {jwt}"}})
        client.postgrest.auth(jwt)
        return client

    # Admin access using Service Role Key
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("WARNING: SUPABASE_SERVICE_ROLE_KEY not found. Operations may fail.")
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    try:
        if not url or not key:
            print("WARNING: Supabase credentials missing.")
            return None
        return create_client(url, key)
    except Exception as e:
        print(f"CRITICAL: Failed to initialize Supabase client: {e}")
        return None
