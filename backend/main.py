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
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(".env.local", override=True)

# # from backend.utils.db import get_supabase (imported but not used in main) (imported but not used in main)
from backend.api import (
    admin_routes,
    hotel_routes,
    monitor_routes,
    dashboard_routes,
    reports_routes,
    profile_routes,
    analysis_routes,
    alerts_routes
)

# Initialize FastAPI
app = FastAPI(
    title="Hotel Rate Monitor API",
    description="API for monitoring hotel competitor pricing",
    version="1.1.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    error_header = f"CRITICAL 500: {str(exc)}"
    print(error_header)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": error_header, "trace": traceback.format_exc()},
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

# Include Modular Routers
app.include_router(admin_routes.router)
app.include_router(hotel_routes.router)
app.include_router(monitor_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(reports_routes.router)
app.include_router(profile_routes.router)
app.include_router(analysis_routes.router)
app.include_router(alerts_routes.router)

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
