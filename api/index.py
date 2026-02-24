import os
import sys

# Define path to the root directory
path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if path not in sys.path:
    sys.path.append(path)

# Import the FastAPI application from backend.main
try:
    from backend.main import app as _app
    app = _app
    
    # EXPLANATION: Runtime Route Diagnostic
    # If we are getting 404s, we need to know what the app actually thinks its routes are.
    @app.get("/api/debug/routes-list")
    async def list_registered_routes():
        return {
            "routes": [{"path": r.path, "name": r.name} for r in app.routes],
            "sys_path": sys.path,
            "cwd": os.getcwd()
        }
except Exception as e:
    import traceback
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI()
    error_detail = f"CRITICAL IMPORT ERROR: {str(e)}\n{traceback.format_exc()}"
    print(error_detail)
    
    @app.get("/{path:path}")
    async def catch_all(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Emergency Backend Diagnostic (Import Failed)",
                "detail": error_detail,
                "hint": "Check requirements.txt or circular imports."
            }
        )

# Version: 2026-02-24 10:48
