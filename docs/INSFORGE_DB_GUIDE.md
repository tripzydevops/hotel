# InsForge Database Connectivity Guide

This document explains the mandatory configuration required for backend services and scripts to connect to the InsForge-hosted Supabase database.

## The 404 Connectivity Issue

Standard Supabase client initialization (e.g., `create_client(url, key)`) targets the root path of the provided URL. On the InsForge platform, the database records (PostgREST API) are served under a specific sub-path: `/api/database/records`.

Failing to redirect traffic to this path results in persistent `404 Not Found` errors for every database operation (select, insert, update, etc.).

## The Solution: Centralized Factory

To prevent these errors and ensure consistency across the application, always use the centralized database factory:

**Location**: `backend/utils/db.py`

### Usage in Scripts

```python
from backend.utils.db import get_supabase_client, load_env_standard

# 1. Load environment variables (handles .env.local automatically)
load_env_standard()

# 2. Initialize the redirected client
supabase = get_supabase_client()

# 3. Perform operations as usual
res = supabase.table("hotels").select("*").limit(1).execute()
```

### Usage in FastAPI Routers

```python
from fastapi import Depends
from backend.utils.db import get_supabase  # Alias for the dependency

@router.get("/my-endpoint")
async def my_endpoint(db = Depends(get_supabase)):
    return db.table("my_table").select("*").execute()
```

## Internal Redirection Logic

The `get_supabase_client` function performs the following critical steps:

1.  **Initial Client Creation**: Uses standard `create_client`.
2.  **Path Override**: Utilizes the `yarl` library to safely append the mandatory path:
    ```python
    from yarl import URL
    base = URL(target_url)
    supabase.postgrest.base_url = base / "api/database/records"
    ```
3.  **Timeout configuration**: Sets default 30-second timeouts for both PostgREST and Storage to handle occasional network latency.

> [!IMPORTANT]
> **NEVER** use `create_client` directly in new backend code. Always import from `backend.utils.db`.
