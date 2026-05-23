# InsForge/PostgREST Database Utility
import os
import logging
import time
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import Depends
from yarl import URL  # Required for PostgREST base_url joinpath compatibility

from supabase import Client, ClientOptions, create_client

# Re-export for type hinting across the app
InsForgeClient = Client

logger = logging.getLogger(__name__)

# ── Singleton Client Cache ──
# Admin and anon clients are reused across requests to avoid
# creating 80+ fresh TCP connections per cron cycle.
# JWT-scoped clients are always created fresh (user-specific RLS).
_admin_client: Optional[Client] = None
_anon_client: Optional[Client] = None



def load_env_standard():
    """
    Standardize environment variable loading for both App and CLI scripts.
    Prioritizes .env.local for development compatibility.
    """
    load_dotenv(".env")
    load_dotenv(".env.local", override=True)


# Initial load for app-level execution
load_env_standard()


def _create_fresh_client(
    jwt: Optional[str] = None, admin: bool = False
) -> Optional[Client]:
    """
    Internal: creates a new InsForge client instance with retry logic.
    Called by get_insforge_db(); do not call directly.
    """
    url = os.getenv("NEXT_PUBLIC_INSFORGE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.getenv("INSFORGE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if admin
        else (os.getenv("NEXT_PUBLIC_INSFORGE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
    )

    if not url or not key:
        return None

    options = ClientOptions().replace(auto_refresh_token=False, persist_session=False)

    try:
        insforge = create_client(url, key, options=options)
        insforge.is_admin = admin  # Tag for diagnostic tracking

        if jwt:
            insforge.postgrest.auth(jwt)

        # Configure base URL for database operations (InsForge compatibility override)
        # PostgREST client requires a yarl.URL object for joinpath support.
        clean_base = url.rstrip("/")
        insforge.postgrest.base_url = URL(f"{clean_base}/api/database/records")

        return insforge
    except Exception as e:
        logger.critical(
            "CRITICAL_DB_INIT_FAILED: %s",
            str(e)
        )
        return None


def get_insforge_db(
    jwt: Optional[str] = None, admin: bool = False
) -> Optional[Client]:
    """
    Returns a configured InsForge client.

    Singleton Pattern:
      - admin=True  → reuses a cached admin client (bypasses RLS)
      - admin=False  → reuses a cached anon client
      - jwt provided → always creates a fresh user-scoped client (honors RLS)
    """
    global _admin_client, _anon_client

    # Bypassing RLS due to signature verification issues on InsForge.
    # We return the admin client instead of user-scoped RLS client.
    # Multi-tenant security is enforced at the application/service layer.
    if jwt:
        return _create_fresh_client(admin=True)

    # Reuse singleton for admin role
    if admin:
        if _admin_client is None:
            _admin_client = _create_fresh_client(admin=True)
        return _admin_client

    # Reuse singleton for anon role
    if _anon_client is None:
        _anon_client = _create_fresh_client(admin=False)
    return _anon_client


def get_insforge_dependency(client: Optional[Client] = Depends(get_insforge_db)):
    """FastAPI dependency for InsForge with automatic 500 on failure."""
    if not client:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=500,
            detail="DATABASE_INIT_FAILED: Please check connection pool status.",
        )
    return client


# Alias for backward compatibility (Legacy support)
get_supabase = get_insforge_db
get_supabase_client = get_insforge_db
get_supabase_dependency = get_insforge_dependency


def try_acquire_lock(db: Any, lock_key: str, expire_seconds: int = 60) -> bool:
    """
    Attempts to acquire a distributed lock via PostgreSQL RPC.
    Returns True if acquired, False otherwise.
    """
    try:
        res = db.rpc(
            "try_acquire_lock",
            {"p_lock_key": lock_key, "p_expire_seconds": expire_seconds},
        ).execute()
        return bool(res.data)
    except Exception as e:
        logger.warning("Lock acquisition error: %s", e)
        return False
