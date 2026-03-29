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

from fastapi import FastAPI, Request, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Union
import traceback

# GZipMiddleware compresses API responses to reduce bandwidth and speed up data transfer
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from supabase import Client
from backend.utils.db import get_supabase
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Load environment variables
load_dotenv()
load_dotenv(".env.local", override=True)

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
)

# EXPLANATION: Vercel Dependency & Import Safety
# The 'monitor_routes' (and by extension 'main.py') imports 'AnalystAgent', which
# relies on 'google-genai' SDK. If this package is missing in the root 'requirements.txt'
# (which Vercel uses for builds), the entire backend will crash with a 500 error at startup.
# We explicitly pinned 'google-genai>=1.0.0' to resolve this.
# KAİZEN: Always use gemini-3-* models. gemini-1.5-* is legacy.


# Initialize FastAPI
# EXPLANATION: Vercel Routing Normalization
# Per Attempt 12 (Critical Logic Fix): We MUST NOT set root_path="/api"
# because our routers already include the "/api" prefix. Setting it
# causes FastAPI to strip "/api" from incoming requests, making them
# fail to match the registered routes (Double Prefixing Conflict).
# KAİZEN: redirect_slashes=False prevents 307 redirects for CORS preflights.
app = FastAPI(
    title="Hotel Price API",
    description="Sentinel Core Engine - Market Intelligence Platform",
    version="2026.03 (V23)",
    redirect_slashes=False,
)

# SECURITY MIDDLEWARE: Inject standard protection headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.insforge.app; "
        "connect-src 'self' https://*.insforge.app https://*.vercel.app; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline';"
    )
    return response


# DIAGNOSTIC MIDDLEWARE: Log every request path to identify Vercel prefix issues
@app.middleware("http")
async def log_requests(request: Request, call_next):
    path = request.url.path
    method = request.method
    print(f"DEBUG: Request {method} {path}")
    response = await call_next(request)
    print(f"DEBUG: Response {response.status_code} for {path}")
    return response


# ROUTE NORMALIZATION: (Deprecated /p-api stripping removed in favor of unified /api pathing)



# DIAGNOSTIC: Root Ping
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


# CORS configuration
# KAİZEN: Ultra-robust manual CORS handling.
# Standard CORSMiddleware can sometimes be bypassed by other middlewares or return 405 on OPTIONS.
# This middleware ENSURES headers are set for all Vercel and InsForge origins.
@app.middleware("http")
async def manual_cors_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        response = JSONResponse(content="OK")
    else:
        response = await call_next(request)
    
    origin = request.headers.get("origin")
    if origin and response and (".vercel.app" in origin or ".insforge.app" in origin or "localhost" in origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin"
        response.headers["Access-Control-Max-Age"] = "86400"
    
    return response

# Enable Gzip compression for all responses larger than 1000 bytes
# This significantly improves performance for data-heavy API endpoints
app.add_middleware(GZipMiddleware, minimum_size=1000)


# EXPLANATION: Centralized Error Handler (backend-specialist pattern)
# Per .agent rules: "Don't expose internal errors to client" and
# "Implement centralized error handling". Traces are logged server-side only.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for all unhandled errors.
    Ensures internal tracing is logged but not exposed to client.
    """
    # EXPLANATION: Transparent Error Handling
    # We do NOT want to mask 401, 403, 404, etc. as 500s because it hides
    # the root cause from the client and makes debugging impossible.
    if hasattr(exc, "status_code"):
        status_code = getattr(exc, "status_code")
        detail = getattr(exc, "detail", str(exc))
        return JSONResponse(
            status_code=status_code,
            content={"detail": str(detail)}
        )

    print(f"CRITICAL 500 on {request.url.path}: {str(exc)}")
    traceback.print_exc()

    # EXPLANATION: Debug-Friendly Error Response
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"VALIDATION ERROR: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )


# Basic Health/Diagnostic Endpoints
@app.get("/api/health/db")
async def db_health():
    import os
    return {
        "resolved_url": "https://pa5riyqv.eu-central.insforge.app",
        "env_url": os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        "key_present": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
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


# Include Modular Routers
app.include_router(admin_routes.router)
app.include_router(hotel_routes.router)
app.include_router(monitor_routes.router)
app.include_router(monitor_routes.router_legacy)

app.include_router(dashboard_routes.router)
app.include_router(reports_routes.router)
app.include_router(profile_routes.router)
app.include_router(analysis_routes.router)
app.include_router(alerts_routes.router)
app.include_router(landing_routes.router)
app.include_router(pulse_routes.router)
app.include_router(market_routes.router)
app.include_router(execution_routes.router)
app.include_router(recovery_routes.router)
app.include_router(auth_routes.router)
# REMOVED: auth_routes.v1_router (prefix="/auth/v1")
# The /auth/v1/* paths must be proxied directly to InsForge by Vercel.
# FastAPI was intercepting these and returning 401 HTML because it expects
# a Bearer token, but the InsForge SDK sends credentials.


# Vercel Cron/Scheduler Entry Point (Keep in main for simple discovery by cron services)
@app.get("/api/cron")
async def trigger_cron_job(key: str, background_tasks: BackgroundTasks):
    """External cron entry point."""
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        logger.critical("SECURITY CONFIG ERROR: CRON_SECRET not set in environment.")
        return JSONResponse(status_code=500, content={"detail": "System configuration error"})
        
    if key != cron_secret:
        return JSONResponse(status_code=403, content={"detail": "Invalid Cron Key"})

    from backend.services.monitor_service import run_scheduler_check_logic
    from backend.services.market.sync_service import run_market_sync_if_needed
    from backend.utils.db import get_supabase

    db = get_supabase()
    background_tasks.add_task(run_scheduler_check_logic)
    background_tasks.add_task(run_market_sync_if_needed, db)
    return {"status": "success", "message": "Scheduler and Market Sync triggered"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
