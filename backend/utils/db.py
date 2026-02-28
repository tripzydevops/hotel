"""
Shared database utilities and dependencies.
Provides the Supabase client and consistent auth helpers.
"""

import os
from supabase import create_client, Client


def get_supabase() -> Client:
    """
    Dependency to provide a Supabase client.
    Uses SERVICE_ROLE_KEY for backend operations to bypass RLS when necessary.

    Reminder Note: The SERVICE_ROLE_KEY should NEVER be exposed to the frontend.
    It allows full admin access to the database.
    """
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    # Prefer Service Role for backend logic, fallback to Anon for simple reads if necessary
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("WARNING: SUPABASE_SERVICE_ROLE_KEY not found. Falling back to ANON_KEY. This may cause RLS-related data gaps (e.g., empty scan history).")
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")


    try:
        if not url or not key:
            print(
                "WARNING: Supabase credentials missing (URL or Key). Check environment variables."
            )
            return None
        return create_client(url, key)
    except Exception as e:
        print(f"CRITICAL: Failed to initialize Supabase client: {e}")
        return None
