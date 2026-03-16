# Vercel requires the app to be exposed as a variable named 'app'
# This file acts as the bridge between Vercel Serverless and FastAPI

try:
    from backend.main import app
except Exception as e:
    import traceback
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI()
    
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def catch_all(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "status": "BOOT_CRASH",
                "error": str(e),
                "traceback": traceback.format_exc(),
                "cwd": os.getcwd(),
                "sys_path": sys.path,
                "env": {k: "SET" if v else "UNSET" for k, v in os.environ.items() if "KEY" in k or "URL" in k or "SECRET" in k}
            }
        )

# Make sure 'app' is available for Vercel
import os
import sys
