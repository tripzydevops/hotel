"""
Hotel Rate Monitor - FastAPI Backend
Main entry point using modular routers.
"""

# ruff: noqa
import os
import sys
from datetime import datetime

# Ensure backend module is resolvable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
# GZipMiddleware compresses API responses to reduce bandwidth and speed up data transfer
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

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
app = FastAPI(
    title="Hotel Rate Monitor API",
    description="API for monitoring hotel competitor pricing",
    version="1.1.0",
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
    print(f"CRITICAL 500 on {request.url.path}: {str(exc)}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Please try again."},
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

@app.get("/api/debug/routes")
async def debug_routes():
    """List all registered routes for debugging 404 errors."""
    redis_status = "unknown"
    redis_error = None
    try:
        from backend.celery_app import celery_app
        with celery_app.connection_for_write() as conn:
            conn.ensure_connection(max_retries=1)
            redis_status = "connected"
    except Exception as e:
        redis_status = "failed"
        redis_error = str(e)

    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            routes.append({
                "path": route.path,
                "name": route.name,
                "methods": list(route.methods) if hasattr(route, "methods") else None
            })
    return {
        "count": len(routes),
        "routes": routes,
        "redis_status": redis_status,
        "redis_error": redis_error,
        "celery_broker": os.getenv("REDIS_URL", "NOT_SET")[:20] + "..." if os.getenv("REDIS_URL") else "MISSING"
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
