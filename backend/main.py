"""
Hotel Rate Monitor - FastAPI Backend
Main entry point using modular routers.
Redeploy trigger: 2026-03-17T11:52:00Z
"""

# ruff: noqa
import os
import sys
from datetime import datetime, timezone

# Ensure backend module is resolvable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from typing import Dict, Any
import traceback

# GZipMiddleware compresses API responses to reduce bandwidth and speed up data transfer
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from supabase import Client
from backend.utils.db import get_supabase
from backend.utils.logger import get_logger
from backend.services.retention_service import RetentionService

logger = get_logger(__name__)

# Load environment variables
# Env is loaded by db.py's load_env_standard()

# Log API key awareness (masked)
g_key = os.environ.get("GEMINI_API_KEY")
masked_g_key = "LOADED_SUCCESSFULLY" if g_key else "NOT-SET"
logger.info(f"System Startup: GEMINI_API_KEY is {masked_g_key}")

# from backend.api import ...
from backend.api import (
    admin_routes,
    hotel_routes,
    monitor_routes,
    dashboard_routes,
    reports_routes,
    profile_routes,
    analysis_routes,
    alerts_routes,
    landing_routes,
    pulse_routes,
    market_routes,
    execution_routes,
    recovery_routes,
    auth_routes,
    webhook_routes,
    hotel_webhook,
    signals_routes,
    intelligence_routes,
    copilot_routes,
)
from backend.api.v1.webhooks import dataforseo as dataforseo_v1

# Import Safety: Ensure all required dependencies are installed.
# Using gemini-3-* models is recommended.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup health check.
    """
    from backend.services.ai_service import HAS_GENAI

    logger.info("--- STARTUP DIAGNOSTICS ---")
    logger.info(
        f"AI Service: {'ENABLED' if HAS_GENAI else 'DISABLED (google-genai SDK missing)'}"
    )
    logger.info(f"Analysis Module: {'READY' if ANALYSIS_ENABLED else 'FAILED TO INITIALIZE'}")

    # Check DB Connection (Proactive Error Handling)
    try:
        from backend.utils.db import get_supabase_client

        db = get_supabase_client(admin=True)
        if db:
            logger.info("Database Connection: OK")
        else:
            logger.error("Database Connection: FAILED (Empty Client)")
    except Exception as e:
        logger.error(f"Database Connection: ERROR ({e})")
    logger.info("---------------------------")
    yield


# Initialize FastAPI
# Routing is configured to avoid double-prefixing with Vercel.
app = FastAPI(
    title="Hotel Price API",
    description="Sentinel Core Engine - Market Intelligence Platform",
    version="2026.03",
    # redirect_slashes=True is the default and preferred for link robustness
    lifespan=lifespan,
)


# Unified Middleware (CORS, Security Headers, and Logging)
@app.middleware("http")
async def unified_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method
    logger.debug(f"Request {method} {path}")

    if method == "OPTIONS":
        from fastapi.responses import JSONResponse
        response = JSONResponse(content="OK")
    else:
        response = await call_next(request)

    logger.debug(f"Response {response.status_code} for {path}")

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        logger.info(f"Auth header detected on {path}")
    elif path.startswith("/api/auth"):
        logger.info(f"No auth header on sensitive path: {path}")

    origin = request.headers.get("origin", "")
    ALLOWED_ORIGINS = [
        "https://hotelplustr.com",
        "https://pa5riyqv.eu-central.insforge.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    is_allowed = origin in ALLOWED_ORIGINS

    if origin and is_allowed and response:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
        )
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-Requested-With, Accept, Origin, apikey, Prefer"
        )
        response.headers["Access-Control-Max-Age"] = "86400"

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.insforge.app; "
        "connect-src 'self' https://*.insforge.app https://*.vercel.app; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline';"
    )

    return response


# Root Health Check
@app.get("/ping")
async def root_ping():
    return {
        "status": "ok",
        "message": "Pong from Root (FastAPI received path with stripped prefix or literal start)",
    }


@app.get("/api/ping")
async def api_ping():
    return {
        "status": "ok",
        "message": "Pong from /api/ping (FastAPI matched full path)",
    }


# Enable Gzip compression for all responses larger than 1000 bytes
# This significantly improves performance for data-heavy API endpoints
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Centralized Error Handling
# Internal tracing is logged server-side only to avoid exposure.
@app.exception_handler(Exception)
@app.exception_handler(HTTPException)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for all unhandled errors.
    Ensures internal tracing is logged but not exposed to client.
    """
    if hasattr(exc, "status_code"):
        status_code = getattr(exc, "status_code")
        detail = getattr(exc, "detail", str(exc))

        if status_code >= 500:
            logger.critical(f"HTTP 500 on {request.url.path}: {str(detail)}")
            detail = "Internal Server Error"

        return JSONResponse(status_code=status_code, content={"detail": str(detail)})

    logger.critical(f"Unhandled 500 on {request.url.path}: {str(exc)}")
    logger.error(traceback.format_exc())

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"VALIDATION ERROR on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )


# Basic Health/Diagnostic Endpoints
@app.get("/api/health/db")
async def db_health():
    import os

    return {
        "env_url": os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        "key_present": bool(
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ),
    }


@app.get("/api/health")
async def health_check():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    return {
        "status": "healthy",
        "insforge_configured": bool(url),
        "timestamp": datetime.now().isoformat(),
        "version": "1.1.0-modular",
    }


@app.get("/api/debug/system-report")
async def system_report(db: Client = Depends(get_supabase)):
    """Deep diagnostics for environment and database connectivity."""

    # 1. Environment Check (Masked)
    import os

    env_vars = {
        "NEXT_PUBLIC_SUPABASE_URL": "PRESENT"
        if os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        else "MISSING",
        "SUPABASE_SERVICE_ROLE_KEY": "PRESENT"
        if os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        else "MISSING",
        "VERCEL": os.getenv("VERCEL", "0"),
        "PYTHON_VERSION": sys.version,
        "PYTHONPATH": os.getenv("PYTHONPATH", "NOT_SET"),
    }

    # 2. Database Connectivity & Table Check
    db_results: dict[str, Any] = {}
    tables_to_check = ["hotels", "settings", "price_logs", "scan_sessions", "alerts"]

    if not db:
        db_results["status"] = "DB_CLIENT_INIT_FAILED"
    else:
        for table in tables_to_check:
            try:
                # Just check if we can select 1 record
                res = db.table(table).select("*").limit(1).execute()
                db_results[table] = {"status": "OK", "count_hint": len(res.data or [])}
            except Exception as e:
                db_results[table] = {"status": "FAILED", "error": str(e)}

    # 3. Memory & Health (Optional Diagnostic)
    process_stats: dict[str, Any] = {"status": "psutil_not_installed"}
    try:
        import psutil

        process = psutil.Process(os.getpid())
        process_stats = {
            "memory_usage_mb": process.memory_info().rss / (1024 * 1024),
            "pid": os.getpid(),
            "status": "OK",
        }
    except ImportError:
        pass
    except Exception as e:
        process_stats = {"status": "ERROR", "error": str(e)}

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": env_vars,
        "database": db_results,
        "process": process_stats,
    }


# --- ROUTE REGISTRATION ---

# 1. Core Services
app.include_router(auth_routes.router, prefix="/api")
app.include_router(
    auth_routes.v1_router, prefix="/api"
)  # Required for InsForge SDK Login
app.include_router(hotel_routes.router, prefix="/api")
app.include_router(profile_routes.router, prefix="/api")

# 2. Intelligence & Reports
app.include_router(analysis_routes.router, prefix="/api")
ANALYSIS_ENABLED = True

app.include_router(market_routes.router, prefix="/api")
app.include_router(reports_routes.router, prefix="/api")

# 3. Operational Routes
# Centralized API Routing: Registered relative to /api prefix.
app.include_router(admin_routes.router, prefix="/api")
app.include_router(monitor_routes.router, prefix="/api")
app.include_router(monitor_routes.router_legacy, include_in_schema=False, prefix="/api")
app.include_router(dashboard_routes.router, prefix="/api")
app.include_router(alerts_routes.router, prefix="/api")
app.include_router(landing_routes.router, prefix="/api")
app.include_router(pulse_routes.router, prefix="/api")
app.include_router(execution_routes.router, prefix="/api")
app.include_router(recovery_routes.router, prefix="/api")
app.include_router(webhook_routes.router, prefix="/api")
app.include_router(dataforseo_v1.router, prefix="/api")
app.include_router(hotel_webhook.router, prefix="/api")
app.include_router(signals_routes.router, prefix="/api")
app.include_router(intelligence_routes.router, prefix="/api")
app.include_router(copilot_routes.router, prefix="/api")



# Startup event has been migrated to lifespan context manager above.


# The /auth/v1/* paths must be proxied directly to InsForge by Vercel.
# FastAPI was intercepting these and returning 401 HTML because it expects
# a Bearer token, but the InsForge SDK sends credentials.


# Vercel Cron/Scheduler Entry Point (Keep in main for simple discovery by cron services)
@app.get("/api/cron")
async def trigger_cron_job(key: str):
    """External cron entry point."""
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        logger.critical("SECURITY CONFIG ERROR: CRON_SECRET not set in environment.")
        return JSONResponse(
            status_code=500, content={"detail": "System configuration error"}
        )

    if key != cron_secret:
        return JSONResponse(status_code=403, content={"detail": "Invalid Cron Key"})

    from backend.services.monitor_service import run_scheduler_check_logic
    from backend.services.market.sync_service import run_market_sync_if_needed
    from backend.utils.db import get_supabase
    import asyncio

    db = get_supabase(admin=True)

    try:
        # Standard maintenance batch processing.
        # Enforces a 55s timeout to stay within serverless limits.
        await asyncio.wait_for(
            asyncio.gather(
                run_scheduler_check_logic(),
                run_market_sync_if_needed(db),
                RetentionService.run_maintenance_cycle(db),
            ),
            timeout=55.0,
        )
        return {
            "status": "success",
            "message": "Batch processed and maintenance complete",
        }
    except asyncio.TimeoutError:
        logger.warning(
            "CRON: Batch processing timed out after 55s, but locks should prevent duplicate runs."
        )
        return {
            "status": "timeout",
            "message": "Processing partially completed (timeout)",
        }
    except Exception as e:
        logger.error(f"CRON ERROR: {str(e)}")
        return JSONResponse(
            status_code=500, content={"status": "error", "detail": str(e)}
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
