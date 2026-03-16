"""
Hotel Rate Monitor - FastAPI Backend
Main entry point using modular routers.
"""

# ruff: noqa
import os
import sys
from datetime import datetime, timezone

# Ensure backend module is resolvable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request, Depends, BackgroundTasks, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Union, Optional
import traceback
import httpx

from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from supabase import Client
from backend.utils.db import get_supabase
from backend.utils.logger import get_logger
import json

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
    title="Hotel Rate Sentinel API", 
    version="2026.02",
    redirect_slashes=False
)

# DIAGNOSTIC MIDDLEWARE: Log every request path to identify prefix issues
@app.middleware("http")
async def log_requests(request: Request, call_next):
    path = request.url.path
    method = request.method
    logger.info(f"DEBUG: Request {method} {path}")
    try:
        response = await call_next(request)
        logger.info(f"DEBUG: Response {response.status_code} for {path}")
        return response
    except Exception as e:
        logger.error(f"DEBUG: Exception for {path}: {str(e)}")
        raise e

# CORS configuration
# KAİZEN: Allow all for bridge stability, but handle credentials correctly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    if isinstance(exc, HTTPException):
        # Explicit cast or direct access for type safety
        status_code = getattr(exc, "status_code", 500)
        detail = getattr(exc, "detail", str(exc))
        return JSONResponse(
            status_code=status_code,
            content={"detail": detail}
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



# KAIZEN: Modular routers take priority over the catch-all bridge below.
# This ensures local /api/... routes work while unknown /p-api/... hits the origin.


# Basic Health/Diagnostic Endpoints
@app.get("/api/health")
async def health_check():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    return {
        "status": "healthy",
        "supabase_configured": bool(url),
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



# --- EXPLICIT PROXY GATEWAY ---
# Handles traffic to InsForge remote services via specific endpoints.
# This prevents shadowing of local /api/... routes.

PHASE_21_ORIGIN = "https://pa5riyqv.eu-central.insforge.app"

async def proxy_to_origin(request: Request, sub_path: str, prefix: Optional[str] = None):
    """
    Robust proxy logic for InsForge services.
    Handles cookie forwarding, content-length recalculation, and error logging.
    """
    # Build target URL
    # Normalize sub_path to prevent double /api/api
    clean_path = sub_path.lstrip('/')
    if clean_path.startswith("api/"):
        clean_path = clean_path[4:]
        
    if prefix:
        target_url = f"{PHASE_21_ORIGIN}/api/{prefix}/{clean_path}"
    else:
        target_url = f"{PHASE_21_ORIGIN}/api/{clean_path}"
        
    if request.query_params:
        target_url = f"{target_url}?{request.query_params}"

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            # 1. Prepare Headers
            # We must forward Authorization and Cookie for session persistence.
            # We MUST strip Host and Content-Length to avoid '400 Bad Request' on some proxies.
            headers = {
                k: v for k, v in request.headers.items() 
                if k.lower() not in ["host", "content-length", "connection"]
            }
            
            body = await request.body()
            logger.info(f"GATEWAY [{prefix or 'FB'}]: {request.method} /{sub_path} -> {target_url}")

            # 2. Execute Request
            logger.debug(f"PROXY HEADERS: {headers}")
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body
            )
            
            if resp.status_code >= 400:
                logger.warning(f"ORIGIN [{prefix or 'FB'}] {resp.status_code}: {resp.text[:150]}")

            # 3. Prepare Response Headers
            # We MUST forward 'set-cookie' for successful authentication flows.
            # We strip encoding headers to let FastAPI/Vercel handle compression.
            response = Response(
                content=resp.content,
                status_code=resp.status_code
            )
            
            for k, v in resp.headers.items():
                k_lower = k.lower()
                if k_lower in ["content-encoding", "transfer-encoding", "connection", "content-length"]:
                    continue
                # For set-cookie, we might have multiples. Starlette handles this if we add them one by one.
                if k_lower == "set-cookie":
                    # Use raw headers or set_cookie to avoid overwriting
                    response.raw_headers.append((b"set-cookie", v.encode("latin-1")))
                else:
                    response.headers[k] = v
                
            response.headers["X-Gateway-Phase"] = "21-hardened-cookies"
            return response
    except Exception as e:
        logger.error(f"GATEWAY CRITICAL [{prefix or 'FB'}]: {str(e)}")
        return JSONResponse(
            status_code=502, 
            content={"detail": f"Gateway Critical Failure: {str(e)}"}
        )

# 1. Auth Gateway
@app.api_route("/p-api/auth/{sub_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def auth_gateway(request: Request, sub_path: str):
    return await proxy_to_origin(request, sub_path, "auth")

# 2. REST (Database) Gateway
@app.api_route("/p-api/rest/{sub_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def rest_gateway(request: Request, sub_path: str):
    return await proxy_to_origin(request, sub_path, "rest")

# 3. Storage Gateway
@app.api_route("/p-api/storage/{sub_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def storage_gateway(request: Request, sub_path: str):
    return await proxy_to_origin(request, sub_path, "storage")

# 4. Catch-all fallback
@app.api_route("/p-api/{sub_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def p_api_catchall(request: Request, sub_path: str):
    return await proxy_to_origin(request, sub_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
