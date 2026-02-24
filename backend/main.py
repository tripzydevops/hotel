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

from fastapi import FastAPI, Request, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
# GZipMiddleware compresses API responses to reduce bandwidth and speed up data transfer
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from supabase import Client
from backend.utils.db import get_supabase

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
    pulse_routes
)

# EXPLANATION: Vercel Dependency & Import Safety
# The 'monitor_routes' (and by extension 'main.py') imports 'AnalystAgent', which
# relies on 'google-genai' SDK. If this package is missing in the root 'requirements.txt'
# (which Vercel uses for builds), the entire backend will crash with a 500 error at startup.
# We explicitly pinned 'google-genai>=1.0.0' to resolve this.


# Initialize FastAPI
# EXPLANATION: Vercel Routing Normalization
# We use root_path="/api" to ensure that the app correctly handles 
# path stripping performed by Vercel when rewriting /api/* to /api/index.py.
# This fixes 404/405 errors caused by path mismatches.
app = FastAPI(
    title="Hotel Rate Sentinel API",
    version="2026.02"
)

# CORS configuration
# KAIZEN: Restrict CORS to authorized origins only
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
if not any(allowed_origins):
    allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
    import traceback
    from fastapi import HTTPException
    
    # EXPLANATION: Transparent Error Handling
    # We do NOT want to mask 401, 403, 404, etc. as 500s because it hides
    # the root cause from the client and makes debugging impossible.
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
        
    print(f"CRITICAL 500 on {request.url.path}: {str(exc)}")
    traceback.print_exc()
    
    # EXPLANATION: Debug-Friendly Error Response
    # We include the exception message in the response to help debug cloud-specific issues.
    # In a strict production environment, this should be logged to Sentry/Datadog and masked.
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
@app.get("/api/ping")
async def ping():
    return {"status": "pong"}

@app.get("/api/health")
async def health_check():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    return {
        "status": "healthy", 
        "supabase_configured": bool(url),
        "timestamp": datetime.now().isoformat(),
        "version": "1.1.0-modular"
    }

@app.get("/api/debug/system-report")
async def system_report(db: Client = Depends(get_supabase)):
    """Deep diagnostics for environment and database connectivity."""
    
    # 1. Environment Check (Masked)
    import os
    env_vars = {
        "NEXT_PUBLIC_SUPABASE_URL": "PRESENT" if os.getenv("NEXT_PUBLIC_SUPABASE_URL") else "MISSING",
        "SUPABASE_SERVICE_ROLE_KEY": "PRESENT" if os.getenv("SUPABASE_SERVICE_ROLE_KEY") else "MISSING",
        "VERCEL": os.getenv("VERCEL", "0"),
        "PYTHON_VERSION": sys.version,
        "PYTHONPATH": os.getenv("PYTHONPATH", "NOT_SET")
    }
    
    # 2. Database Connectivity & Table Check
    db_results = {}
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
    process_stats = {"status": "psutil_not_installed"}
    try:
        import psutil
        process = psutil.Process(os.getpid())
        process_stats = {
            "memory_usage_mb": process.memory_info().rss / (1024 * 1024),
            "pid": os.getpid(),
            "status": "OK"
        }
    except ImportError:
        pass
    except Exception as e:
        process_stats = {"status": "ERROR", "error": str(e)}
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": env_vars,
        "database": db_results,
        "process": process_stats
    }

@app.get("/api/debug/redis")
async def debug_redis():
    """Explicit Redis probe for Vercel debugging."""
    import os
    from celery import Celery
    import ssl
    
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return {"status": "error", "message": "REDIS_URL env var is MISSING"}
    
    try:
        # Test 1: Simple Connection
        app = Celery('test', broker=redis_url)
        app.conf.update(
            broker_use_ssl={'ssl_cert_reqs': ssl.CERT_NONE},
            redis_backend_use_ssl={'ssl_cert_reqs': ssl.CERT_NONE}
        )
        with app.connection_for_write() as conn:
            conn.ensure_connection(max_retries=1)
            return {"status": "ok", "message": "Connected to Redis successfully", "transport": str(conn.transport)}
    except Exception as e:
        return {"status": "error", "message": str(e), "type": type(e).__name__}


# Include Modular Routers
app.include_router(admin_routes.router)
app.include_router(hotel_routes.router)
app.include_router(monitor_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(reports_routes.router)
app.include_router(profile_routes.router)
app.include_router(analysis_routes.router)
app.include_router(alerts_routes.router)
app.include_router(landing_routes.router)
app.include_router(pulse_routes.router)

# Vercel Cron/Scheduler Entry Point (Keep in main for simple discovery by cron services)
@app.get("/api/cron")
async def trigger_cron_job(
    key: str,
    background_tasks: BackgroundTasks
):
    """External cron entry point."""
    cron_secret = os.getenv("CRON_SECRET", "super_secret_cron_key_123")
    if key != cron_secret:
        return JSONResponse(status_code=403, content={"detail": "Invalid Cron Key"})
    
    from backend.services.monitor_service import run_scheduler_check_logic
    background_tasks.add_task(run_scheduler_check_logic)
    return {"status": "success", "message": "Scheduler triggered"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
