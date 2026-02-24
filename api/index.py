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
                "error": "Emergency Backend Diagnostic",
                "detail": error_detail,
                "hint": "Check requirements.txt or circular imports."
            }
        )

# Version: 2026-02-24 10:28
